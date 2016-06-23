var LoadingManager = (function () {

    var mainApp = MainApp(),
        atlasJson = AtlasJson(),
        vtkLoader = new THREE.VTKLoader(),
        singleton = {
            numberOfModelsLoaded : 0,
            numberOfVolumesLoaded : 0
        },
        modelsLoaded = {};

    function onNewMesh (structure, mesh, fileName) {
        mesh.name = structure.annotation && structure.annotation.name || '';
        mesh.renderOrder = 1;
        structure.mesh = mesh;
        mesh.atlasStructure = structure;

        modelsLoaded[fileName] = true;
        singleton.numberOfModelsLoaded++;

        //signal to the modal
        mainApp.emit('loadingManager.modelLoaded', fileName);

        mainApp.emit('loadingManager.newMesh', mesh);

        if (singleton.numberOfModelsLoaded === singleton.totalNumberOfModels) {
            mainApp.emit('loadingManager.everyModelLoaded');
            testIfLoadingIsFinished();
        }
    }

    function loadVTKModel(structure) {
        var file;
        if (Array.isArray(structure.sourceSelector)) {
            var geometrySelector = structure.sourceSelector.find(selector => selector['@type'].includes('GeometrySelector'));
            if (geometrySelector) {
                file = geometrySelector.dataSource.source;

                //prepend base url if it exists
                if (geometrySelector.dataSource.baseURL) {
                    file = geometrySelector.dataSource.baseURL.url + file;
                }
            }
            else {
                throw 'In case of multiple selectors, VTK selector should have an array as @type which includes "GeometrySelector"';
            }
        }
        else {
            file = structure.sourceSelector.dataSource.source;

            //prepend base url if it exists
            if (structure.sourceSelector.dataSource.baseURL) {
                file = structure.sourceSelector.dataSource.baseURL.url + file;
            }
        }

        vtkLoader.load(file, function (geometry) {

            var item = structure;

            geometry.computeVertexNormals();

            var material = new THREE.MeshPhongMaterial({
                wireframe : false,
                morphTargets : false,
                side : THREE.DoubleSide,
                color : item.renderOption.color >> 8 //get rid of alpha
            });

            material.opacity = (item.renderOption.color & 0xff)/255;
            material.visible = true;


            if (material.opacity < 1) {
                material.transparent = true;
            }


            var mesh = new THREE.Mesh(geometry, material);

            onNewMesh(item, mesh, file);

        });
    }

    function dealWithAtlasStructure(data) {
        var i,
            atlasStructure = atlasJson.parse(data);

        mainApp.atlasStructure = atlasStructure;


        //load the models (only VTK and OBJ are supported for now)

        var vtkStructures = atlasStructure.Structure.filter(item => {
            if (Array.isArray(item.sourceSelector)) {
                return item.sourceSelector.some(selector => /\.vtk$/.test(selector.dataSource.source));
            }
            else {
                return /\.vtk$/.test(item.sourceSelector.dataSource.source);
            }
        });

        singleton.totalNumberOfModels = vtkStructures.length;


        for (i = 0; i<vtkStructures.length; i++) {
            loadVTKModel(vtkStructures[i]);
        }



        mainApp.emit('loadingManager.atlasStructureLoaded', atlasStructure);

        //add this event in case the json is loaded before angular compilation is finished
        document.addEventListener('DOMContentLoaded',function () {
            mainApp.emit('loadingManager.atlasStructureLoaded', atlasStructure);
        });

    }

    function loadAtlasStructure (location) {
        var xmlhttp = new XMLHttpRequest();

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                var parsed = JSON.parse(xmlhttp.responseText);
                dealWithAtlasStructure(parsed);
            }
        };
        xmlhttp.open("GET", location, true);
        xmlhttp.send();

        mainApp.emit('loadingManager.atlasStructureStart');
    }

    function testIfLoadingIsFinished () {
        if (singleton.numberOfModelsLoaded === singleton.totalNumberOfModels) {

            //signal that the loading has ended
            mainApp.emit('loadingManager.loadingEnd');

        }
    }

    function isLoading() {
        return singleton.numberOfModelsLoaded !== singleton.totalNumberOfModels;
    }

    singleton.loadVTKModel = loadVTKModel;
    singleton.loadAtlasStructure = loadAtlasStructure;
    singleton.modelsLoaded = modelsLoaded;
    singleton.isLoading = isLoading;


    //methods accessible from outside by injecting volumesManager
    return function () {
        return singleton;
    };
})();
