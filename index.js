var fs = require('fs');

var simpleRegExpReplacements = {
    "*": ".*?",
    "?": ".?"
};

var simpleRegExpTest = /[\?\*]/;

function startsWith(s, prefix) {
    return s.indexOf(prefix) === 0;
}

function RegExpFilter(regex, matchResult) {
    this._regex = regex;
    this._matchResult = matchResult;
}

RegExpFilter.prototype.test = function(path) {
    return path.test(filter) ? this._matchResult || true : false;
}

RegExpFilter.prototype.toString = function() {
    return this._regex.toString();
}

function StringFilter(str, recursive, matchResult) {
    this._str = str;
    this._recursive = recursive !== false;
    this._matchResult = matchResult;
}

StringFilter.prototype.test = function(path) {
    var match = this._recursive ? startsWith(path, this._str) : path === this._str;
    return match ? this._matchResult || true : false;
}

StringFilter.prototype.toString = function() {
    return this._str.toString() + '*';
}

function FunctionFilter(func, matchResult) {
    this._func = func;
    this._matchResult = matchResult;
}

FunctionFilter.prototype.test = function(path) {
    if (this._matchResult) {
        var result = this._func(path);
        return result ? this._matchResult : false;
    } else {
        return this._func(path);
    }
}

FunctionFilter.prototype.toString = function() {
    return this._func.toString();
}

function isSimpleRegExp(str) {
    return simpleRegExpTest.test(str);
}

function escapeRegExpStr(str) {
    return str.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}

function createSimpleRegExp(str) {
    var _this = this;

    return new RegExp("^" + str.replace(/[\*\?]|[^\*\?]*/g, function(match) {
        return simpleRegExpReplacements[match] || escapeRegExpStr(match);
    }) + "$");
}

function createSimpleRegExpFilter(str, matchResult) {
    var simpleRegExp = createSimpleRegExp(str);

    return function(str) {
        return simpleRegExp.test(str) ? matchResult || true : false;
    }
}

function PathFilters() {
    this._filters = [];
}

PathFilters.prototype.getFilters = function() {
    return this._filters;
}

PathFilters.prototype.getMatch = function(path) {
    for (var i = 0, len = this._filters.length; i < len; i++) {
        var result = this._filters[i].test(path);
        if (result !== false) {
            return result;
        }
    }
    return undefined;
}

PathFilters.prototype.getMatches = function(path) {
    var matches = [];
    for (var i = 0, len = this._filters.length; i < len; i++) {
        var result = this._filters[i].test(path);
        if (result !== false) {
            matches.push(result);
        }
    }
    return matches;
}

PathFilters.prototype.hasMatch = function(path) {
    return this.getMatch(path) !== undefined ? true : false;
}

PathFilters.prototype.add = function(filter, recursive, matchResult) {

    if (Array.isArray(filter)) {
        var filters = filter;
        for (var i = 0, len = filters.length; i < len; i++) {
            this.add(filters[i], recursive, matchResult);
        }
        return this;
    }

    var filterImpl;

    if (typeof filter === 'string') {
        if (isSimpleRegExp(filter)) {
            filterImpl = new RegExpFilter(createSimpleRegExp(filter), matchResult);
        } else {
            try {
                var stat = fs.statSync(filter);
                if (stat.isFile()) {
                    recursive = false;
                }
            } catch(e) {
                // ignore
            }

            filterImpl = new StringFilter(filter, recursive, matchResult);
        }
    } else if (filter.constructor === RegExp) {
        filterImpl = new RegExpFilter(filter, matchResult);
    } else if (typeof filter === 'function') {
        filterImpl = new FunctionFilter(filter, matchResult);
    } else {
        throw new Error("Invalid filter: " + filter + " (" + (typeof filter) + ")");
    }

    this._filters.push(filterImpl);

    return this;
}

module.exports = {
    create: function() {
        return new PathFilters();
    }
}