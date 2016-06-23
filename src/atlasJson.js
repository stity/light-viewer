var AtlasJson = (function () {

    var ids,
        resolveQueue,
        resolvedList,
        objectsByType;

    function initVariables () {
        ids = {};
        resolveQueue = [];
        resolvedList = [];
        objectsByType = {
            Header : null,
            Structure : [],
            Group : [],
            DataSource : [],
            Selector : []
        };
    }

    function registerIds (objectList) {
        ids = {};
        var length = objectList.length,
            i,
            object;
        for (i = 0; i < length; i++) {
            object = objectList[i];
            ids[object['@id']] = object;
        }
    }

    function colorToHex (color, opacity) {
        var match,
            r,
            g,
            b,
            a;
        if (opacity !== undefined && opacity < 1) {
            opacity = Math.round(255*opacity);
        }
        if (typeof color === 'number') {
            return color;
        }
        else if (typeof color === 'string') {
            var rgb = /^rgb *\( *(\d+) *, *(\d+) *, *(\d+) *\)$/;
            var rgba = /^rgba *\( *(\d+) *, *(\d+) *, *(\d+) *, *(\d*\.?\d*) *\)$/;
            match = color.match(rgb) || color.match(rgba);
            if (match) {
                r = Number(match[1]);
                g = Number(match[2]);
                b = Number(match[3]);
                a = Number(opacity || match[4] || 255);
                if (a<=1) {
                    a = Math.round(a*255);
                }
                return (r<<24) + (g<<16) + (b<<8) + a;
            }
            var hex = /^#(\w{2})(\w{2})(\w{2})(\w{2})?$/;
            match = color.match(hex);
            if (match) {
                match = match.map(x=>parseInt(x,16));
                r = match[1];
                g = match[2];
                b = match[3];
                a = opacity || match[4] || 255;
                return (r<<24) + (g<<16) + (b<<8) + a;

            }
            var hexshort = /^#(\w)(\w)(\w)(\w)?$/;
            match = color.match(hexshort);
            if (match) {
                match = match.map(x=>parseInt(x+x,16));
                r = match[1];
                g = match[2];
                b = match[3];
                a = opacity || match[4] || 255;
                return (r<<24) + (g<<16) + (b<<8) + a;

            }
        }
        throw 'Application did not manage to parse a color from : '+color;
    }

    function parseColors (structures) {
        var renderOption;
        for (var i = 0; i < structures.length; i++) {
            renderOption = structures[i].renderOption;
            if (renderOption.color) {
                renderOption.color = colorToHex(renderOption.color, renderOption.opacity);
            }
        }
    }

    function resolveReferences (object) {

        var key,
            value,
            retrieved;

        if (!object._resolved) {
            for (key in object) {
                value = object[key];
                if (key[0] !== '@') {
                    if (Array.isArray(value)) {
                        for (var i = 0; i < value.length; i++) {
                            if (typeof value[i] === 'string' && ids[value[i]]) {
                                retrieved = ids[value[i]];
                                value[i] = retrieved;
                                if (!retrieved._resolved) {
                                    resolveQueue.push(retrieved);
                                }
                            }
                            else if (typeof value[i] === 'object') {
                                if (!value[i]._resolved) {
                                    resolveQueue.push(value[i]);
                                }
                            }
                        }
                    }
                    else if (typeof value === 'string' && ids[value]) {
                        retrieved = ids[value];
                        object[key] = retrieved;
                        if (!retrieved._resolved) {
                            resolveQueue.push(retrieved);
                        }
                    }
                    else if (typeof value === 'object') {
                        if (!value._resolved) {
                            resolveQueue.push(value);
                        }
                    }
                }
            }
            object._resolved = true;
            resolvedList.push(object);
            addObjectToTypeList(object);
        }
    }

    function cleanObjects () {
        var length = resolvedList.length,
            i;
        for (i = 0; i < length; i++) {
            delete resolvedList[i]._resolved;
        }
    }

    function addObjectToTypeList (object) {
        var type = object['@type'];
        if (type && Array.isArray(type)) {
            for (var i = 0; i < type.length; i++) {
                var t = type[i];
                (objectsByType[t] ||(objectsByType[t] = [])).push(object);
            }
        }
        else if (typeof type === 'string') {
            if (type === 'Header') {
                if (objectsByType.Header) {
                    throw 'Error : There can only be one header';
                }
                objectsByType.Header = object;
            }
            else {
                (objectsByType[type] ||(objectsByType[type] = [])).push(object);
            }
        }
    }

    function parse (atlasObject) {
        if (typeof atlasObject === 'string') {
            atlasObject = JSON.parse(atlasObject);
        }
        initVariables();
        registerIds(atlasObject);
        resolveQueue = atlasObject.slice();
        var objectToParse;
        while ((objectToParse = resolveQueue.pop()) && objectToParse) {
            resolveReferences(objectToParse);
        }
        parseColors(objectsByType.Structure);
        cleanObjects();
        objectsByType.all = atlasObject;
        return objectsByType;

    }

    return function () {
        return {parse : parse };
    };
})();
