//you should use this file to give the global parameters to the applications.
//all the changes you make to this file will be ignored by git so you can pull new versions of the viewer.

window.globalViewerParameters = {
    atlasStructurePath : "atlasStructure.json",
    logarithmicDepthBuffer : false, //true will set the renderer to use logarithmic depth buffer (lower the performance but enhance the render in case you see models flickering)
    antialias : false, // will improve rendering when set to true but will lower performance
    cameraInitialUpVector : [0, 1, 0], //must be a unit vector
    cameraInitialPositionVector : [0,0,1], //unit vector describing the position of the camera with respect to the center of the scene (distance will first be set to the cameraInitialDistanceToOrigin parameter but once every model is loaded it will be set so that the entire scene is visible)
    cameraInitialDistanceToOrigin : 300 //camera distance to origin used before every model is loaded
};
