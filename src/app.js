var App = (function () {

    var mainApp = MainApp(),
        loadingManager = LoadingManager(),
        container,
        camera,
        controls,
        scene,
        renderer,
        mouse,
        raycaster,
        meshesList = [],
        meshesAndSlicesList = [],
        resizeTimeout = setTimeout(function () {}),
        header,
        lightKit;


    mainApp.on('loadingManager.newMesh', function (mesh) {
        meshesList.push(mesh);
        meshesAndSlicesList.push(mesh);
        scene.add(mesh);
    });

    mainApp.on('loadingManager.everyModelLoaded', function () {
        //put it in an immediate timeout to give the browser the opportunity to refresh the modal
        setTimeout(createHierarchy, 0);
    });

    mainApp.on('loadingManager.atlasStructureLoaded', function (atlasStructure) {
        header = atlasStructure.Header;
    });

    function bindHierarchyItemWithFirebase (item) {
        //fireobject can not sync properties starting with _ so we have to make a proxy
        if (item.visibleInTree === undefined) {
            Object.defineProperty(item, 'visibleInTree', {
                get : function () {
                    return !!item._ad_expanded;
                },
                set : function (value) {
                    item._ad_expanded = !!value;
                }
            });
        }
    }

    function getMesh(item) {

        if (item['@type']==='Group') {
            var childrenMeshes = item.member.map(getMesh);
            //HierarchyGroup is used instead of THREE.Group because THREE.Group does not allow children to have multiple parents
            item.mesh = new HierarchyGroup();
            item.mesh.atlasStructure = item;
            for (var i = 0; i< childrenMeshes.length; i++) {
                try {
                    item.mesh.add(childrenMeshes[i]);
                }
                catch (e) {
                    console.log(e);
                }
            }
        }

        bindHierarchyItemWithFirebase(item);

        return item.mesh;
    }

    function createHierarchy() {
        var rootGroups = header.root;
        rootGroups.map(getMesh);


    }

    function finishSceneSetup() {

        if (finishSceneSetup.done) {
            return;
        }
        // renderer

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({
            antialias : window.globalViewerParameters.antialias || false,
            alpha : true,
            preserveDrawingBuffer : true,
            logarithmicDepthBuffer : window.globalViewerParameters.logarithmicDepthBuffer || false
        });
        renderer.setClearColor( 0x000000, 0 );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( container.clientWidth, container.clientHeight );

        container.appendChild( renderer.domElement );




        //setup resize feature

        //debounce resize to keep it fluid
        function setResizeTimeout () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(onWindowResize, 100);
        }

        window.addEventListener( 'resize', setResizeTimeout);




        //start animating the 3D view
        animate();

        finishSceneSetup.done = true;

    }

    function init() {

        container = document.getElementById('rendererFrame');


        //set position according to global parameters
        var distanceToOrigin = window.globalViewerParameters.cameraInitialDistanceToOrigin || 300;

        camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.05, distanceToOrigin*15 );

        var initialPosition = window.globalViewerParameters.cameraInitialPositionVector || [0,0,1];
        camera.position.x = distanceToOrigin * initialPosition[0];
        camera.position.y = distanceToOrigin * initialPosition[1];
        camera.position.z = distanceToOrigin * initialPosition[2];

        //set up vector according to global parameters
        var initialUp = window.globalViewerParameters.cameraInitialUpVector || [0,1,0];
        camera.up.x = initialUp[0];
        camera.up.y = initialUp[1];
        camera.up.z = initialUp[2];

        mainApp.camera = camera;

        controls = new THREE.TrackballControls( camera, container );

        controls.rotateSpeed = 10.0;
        controls.zoomSpeed = 5;
        controls.panSpeed = 2;

        controls.noZoom = false;
        controls.noPan = false;

        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;

        scene = new THREE.Scene();
        mainApp.scene = scene;

        scene.add( camera );

        mouse = new THREE.Vector2();
        raycaster = new THREE.Raycaster();

        // light

        lightKit = new LightKit(camera, controls, scene);


        //fetch atlas structure
        if (window.globalViewerParameters && window.globalViewerParameters.atlasStructurePath) {
            loadingManager.loadAtlasStructure(window.globalViewerParameters.atlasStructurePath);
        }
        else {
            throw 'Atlas structure path is not defined in global parameters';
        }


        mainApp.on('loadingManager.atlasStructureLoaded', finishSceneSetup);


    }

    function onWindowResize() {

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( container.clientWidth, container.clientHeight );

        controls.handleResize();


    }

    function animate(time) {

        requestAnimationFrame( animate );

        controls.update();
        lightKit.updatePosition();


        renderer.render( scene, camera );

        TWEEN.update(time);

    }

    function tweenCamera (position, target, up) {
        var cameraStart = camera.position.clone().sub(controls.target),
            cameraStartLength = cameraStart.length(),
            cameraEnd = new THREE.Vector3().add(position).sub(target),
            cameraEndLength = cameraEnd.length(),
            tweenDuration = window.globalViewerParameters.cameraTweenDuration || 1000,
            upTweenFinished = false,
            targetTweenFinished = false,
            resolvePromise;


        new TWEEN.Tween(controls.target)
            .to(target, tweenDuration)
            .onUpdate(function (timestamp) {
            var l = (1-timestamp)*cameraStartLength+timestamp*cameraEndLength;
            var t = cameraStart.clone().lerp(cameraEnd, timestamp).setLength(l);
            camera.position.copy(t.add(controls.target));
        }).onComplete(function () {
            controls.target.copy(target);
            camera.position.copy(position);
            targetTweenFinished = true;
            if (upTweenFinished) {
                resolvePromise();
            }

        }).start();

        new TWEEN.Tween(camera.up)
            .to(up, tweenDuration)
            .onUpdate(function () {
            camera.up.normalize();
        }).onComplete(function () {
            camera.up.copy(up);
            upTweenFinished = true;
            if (targetTweenFinished) {
                resolvePromise();
            }
        }).start();

        var promise = new Promise(function (resolve) {
            resolvePromise = resolve;
        });

        return promise;
    }


    function getSceneBoundingBox () {
        var min = new THREE.Vector3(Infinity, Infinity, Infinity),
            max = new THREE.Vector3(-Infinity, -Infinity, -Infinity),
            i,
            mesh,
            bb;

        for (i = 0; i < meshesAndSlicesList.length; i++) {
            mesh = meshesAndSlicesList[i];
            mesh.geometry.computeBoundingBox();
            bb = mesh.geometry.boundingBox.clone();
            min.min(bb.min);
            max.max(bb.max);
        }

        return {min : min, max : max};
    }

    function autocenterCamera (commitAfter) {
        commitAfter = commitAfter || true;
        var bb = getSceneBoundingBox(),
            center = (new THREE.Vector3()).lerpVectors(bb.min, bb.max, 0.5),
            height = 1.2*(Math.max(bb.max.y-center.y, bb.max.x - center.x)) / (Math.tan(camera.fov * Math.PI / 360)),
            initialPosition = window.globalViewerParameters.cameraInitialPositionVector || [0,0,1],
            cameraPosition = new THREE.Vector3(center.x + height*initialPosition[0], center.y + height*initialPosition[1], center.z + height*initialPosition[2]),
            initialUp = window.globalViewerParameters.cameraInitialUpVector || [0,1,0],
            up = new THREE.Vector3(initialUp[0], initialUp[1], initialUp[2]);

        up.normalize();

        lightKit.distanceToTarget = height*15; // simulate infinity

        setCameraPlanes(camera.near, 15*height);
        tweenCamera(cameraPosition, center, up);
    }

    function setCameraPlanes (near, far) {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
    }
    mainApp.on('loadingManager.loadingEnd', function () {
        setTimeout(function () {
            autocenterCamera(false);
        }, 100);
    });

    return function () {
        return {start : init};
    };

})();
