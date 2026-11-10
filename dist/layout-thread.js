import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// node_modules/min-dash/dist/index.js
function isUndefined(obj) {
  return obj === void 0;
}
function isDefined(obj) {
  return obj !== void 0;
}
function isNil(obj) {
  return obj == null;
}
function isArray(obj) {
  return nativeToString.call(obj) === "[object Array]";
}
function isObject(obj) {
  return nativeToString.call(obj) === "[object Object]";
}
function isFunction(obj) {
  const tag = nativeToString.call(obj);
  return tag === "[object Function]" || tag === "[object AsyncFunction]" || tag === "[object GeneratorFunction]" || tag === "[object AsyncGeneratorFunction]" || tag === "[object Proxy]";
}
function isString(obj) {
  return nativeToString.call(obj) === "[object String]";
}
function has(target, key) {
  return !isNil(target) && nativeHasOwnProperty.call(target, key);
}
function find(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let match;
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      match = val;
      return false;
    }
  });
  return match;
}
function findIndex(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let idx = isArray(collection) ? -1 : void 0;
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      idx = key;
      return false;
    }
  });
  return idx;
}
function filter(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let result = [];
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      result.push(val);
    }
  });
  return result;
}
function forEach(collection, iterator) {
  let val, result;
  if (isUndefined(collection)) {
    return;
  }
  const convertKey = isArray(collection) ? toNum : identity;
  for (let key in collection) {
    if (has(collection, key)) {
      val = collection[key];
      result = iterator(val, convertKey(key));
      if (result === false) {
        return val;
      }
    }
  }
}
function map(collection, fn) {
  let result = [];
  forEach(collection, function(val, key) {
    result.push(fn(val, key));
  });
  return result;
}
function toMatcher(matcher) {
  return isFunction(matcher) ? matcher : (e) => {
    return e === matcher;
  };
}
function identity(arg) {
  return arg;
}
function toNum(arg) {
  return Number(arg);
}
function bind(fn, target) {
  return fn.bind(target);
}
function assign(target, ...others) {
  return Object.assign(target, ...others);
}
function set(target, path, value) {
  let currentTarget = target;
  forEach(path, function(key, idx) {
    if (typeof key !== "number" && typeof key !== "string") {
      throw new Error("illegal key type: " + typeof key + ". Key should be of type number or string.");
    }
    if (key === "constructor") {
      throw new Error("illegal key: constructor");
    }
    if (key === "__proto__") {
      throw new Error("illegal key: __proto__");
    }
    let nextKey = path[idx + 1];
    let nextTarget = currentTarget[key];
    if (isDefined(nextKey) && isNil(nextTarget)) {
      nextTarget = currentTarget[key] = isNaN(+nextKey) ? {} : [];
    }
    if (isUndefined(nextKey)) {
      if (isUndefined(value)) {
        delete currentTarget[key];
      } else {
        currentTarget[key] = value;
      }
    } else {
      currentTarget = nextTarget;
    }
  });
  return target;
}
function pick(target, properties) {
  let result = {};
  let obj = Object(target);
  forEach(properties, function(prop) {
    if (prop in obj) {
      result[prop] = target[prop];
    }
  });
  return result;
}
var nativeToString, nativeHasOwnProperty;
var init_dist = __esm({
  "node_modules/min-dash/dist/index.js"() {
    nativeToString = Object.prototype.toString;
    nativeHasOwnProperty = Object.prototype.hasOwnProperty;
  }
});

// node_modules/moddle/dist/index.js
function Base() {
}
function Factory(model, properties) {
  this.model = model;
  this.properties = properties;
}
function coerceType(type, value) {
  var converter = TYPE_CONVERTERS[type];
  if (converter) {
    return converter(value);
  } else {
    return value;
  }
}
function isBuiltIn(type) {
  return !!BUILTINS[type];
}
function isSimple(type) {
  return !!TYPE_CONVERTERS[type];
}
function parseName(name2, defaultPrefix) {
  var parts = name2.split(/:/), localName, prefix2;
  if (parts.length === 1) {
    localName = name2;
    prefix2 = defaultPrefix;
  } else if (parts.length === 2) {
    localName = parts[1];
    prefix2 = parts[0];
  } else {
    throw new Error("expected <prefix:localName> or <localName>, got " + name2);
  }
  name2 = (prefix2 ? prefix2 + ":" : "") + localName;
  return {
    name: name2,
    prefix: prefix2,
    localName
  };
}
function DescriptorBuilder(nameNs) {
  this.ns = nameNs;
  this.name = nameNs.name;
  this.allTypes = [];
  this.allTypesByName = /* @__PURE__ */ Object.create(null);
  this.properties = [];
  this.propertiesByName = /* @__PURE__ */ Object.create(null);
}
function Registry(packages2, properties) {
  this.packageMap = /* @__PURE__ */ Object.create(null);
  this.typeMap = /* @__PURE__ */ Object.create(null);
  this.packages = [];
  this.properties = properties;
  forEach(packages2, bind(this.registerPackage, this));
}
function ensureAvailable(packageMap, pkg, identifierKey) {
  var value = pkg[identifierKey];
  if (value in packageMap) {
    throw new Error("package with " + identifierKey + " <" + value + "> already defined");
  }
}
function Properties(model) {
  this.model = model;
}
function isUndefined2(val) {
  return typeof val === "undefined";
}
function defineProperty(target, property, value) {
  Object.defineProperty(target, property.name, {
    enumerable: !property.isReference,
    writable: true,
    value,
    configurable: true
  });
}
function stripGlobal(name2) {
  return name2.replace(/^:/, "");
}
function Moddle(packages2, config = {}) {
  this.properties = new Properties(this);
  this.factory = new Factory(this, this.properties);
  this.registry = new Registry(packages2, this.properties);
  this.typeCache = /* @__PURE__ */ Object.create(null);
  this.config = config;
}
var BUILTINS, TYPE_CONVERTERS;
var init_dist2 = __esm({
  "node_modules/moddle/dist/index.js"() {
    init_dist();
    Base.prototype.get = function(name2) {
      return this.$model.properties.get(this, name2);
    };
    Base.prototype.set = function(name2, value) {
      this.$model.properties.set(this, name2, value);
    };
    Factory.prototype.createType = function(descriptor) {
      var model = this.model;
      var props = this.properties, prototype = Object.create(Base.prototype);
      forEach(descriptor.properties, function(p) {
        if (!p.isMany && p.default !== void 0) {
          prototype[p.name] = p.default;
        }
      });
      props.defineModel(prototype, model);
      props.defineDescriptor(prototype, descriptor);
      var name2 = descriptor.ns.name;
      function ModdleElement(attrs) {
        props.define(this, "$type", { value: name2, enumerable: true });
        props.define(this, "$attrs", { value: {} });
        props.define(this, "$parent", { writable: true });
        forEach(attrs, bind(function(val, key) {
          this.set(key, val);
        }, this));
      }
      ModdleElement.prototype = prototype;
      ModdleElement.hasType = prototype.$instanceOf = this.model.hasType;
      props.defineModel(ModdleElement, model);
      props.defineDescriptor(ModdleElement, descriptor);
      return ModdleElement;
    };
    BUILTINS = assign(/* @__PURE__ */ Object.create(null), {
      String: true,
      Boolean: true,
      Integer: true,
      Real: true,
      Element: true
    });
    TYPE_CONVERTERS = assign(/* @__PURE__ */ Object.create(null), {
      String: function(s) {
        return s;
      },
      Boolean: function(s) {
        return s === "true";
      },
      Integer: function(s) {
        return parseInt(s, 10);
      },
      Real: function(s) {
        return parseFloat(s);
      }
    });
    DescriptorBuilder.prototype.build = function() {
      return pick(this, [
        "ns",
        "name",
        "allTypes",
        "allTypesByName",
        "properties",
        "propertiesByName",
        "bodyProperty",
        "idProperty"
      ]);
    };
    DescriptorBuilder.prototype.addProperty = function(p, idx, validate) {
      if (typeof idx === "boolean") {
        validate = idx;
        idx = void 0;
      }
      this.addNamedProperty(p, validate !== false);
      var properties = this.properties;
      if (idx !== void 0) {
        properties.splice(idx, 0, p);
      } else {
        properties.push(p);
      }
    };
    DescriptorBuilder.prototype.replaceProperty = function(oldProperty, newProperty, replace) {
      var oldNameNs = oldProperty.ns;
      var props = this.properties, propertiesByName = this.propertiesByName, rename = oldProperty.name !== newProperty.name;
      if (oldProperty.isId) {
        if (!newProperty.isId) {
          throw new Error(
            "property <" + newProperty.ns.name + "> must be id property to refine <" + oldProperty.ns.name + ">"
          );
        }
        this.setIdProperty(newProperty, false);
      }
      if (oldProperty.isBody) {
        if (!newProperty.isBody) {
          throw new Error(
            "property <" + newProperty.ns.name + "> must be body property to refine <" + oldProperty.ns.name + ">"
          );
        }
        this.setBodyProperty(newProperty, false);
      }
      var idx = props.indexOf(oldProperty);
      if (idx === -1) {
        throw new Error("property <" + oldNameNs.name + "> not found in property list");
      }
      props.splice(idx, 1);
      this.addProperty(newProperty, replace ? void 0 : idx, rename);
      propertiesByName[oldNameNs.name] = propertiesByName[oldNameNs.localName] = newProperty;
    };
    DescriptorBuilder.prototype.redefineProperty = function(p, targetPropertyName, replace) {
      var nsPrefix = p.ns.prefix;
      var parts = targetPropertyName.split("#");
      var name2 = parseName(parts[0], nsPrefix);
      var attrName = parseName(parts[1], name2.prefix).name;
      var redefinedProperty = this.propertiesByName[attrName];
      if (!redefinedProperty) {
        throw new Error("refined property <" + attrName + "> not found");
      } else {
        this.replaceProperty(redefinedProperty, p, replace);
      }
      delete p.redefines;
    };
    DescriptorBuilder.prototype.addNamedProperty = function(p, validate) {
      var ns = p.ns, propsByName = this.propertiesByName;
      if (validate) {
        this.assertNotDefined(p, ns.name);
        this.assertNotDefined(p, ns.localName);
      }
      propsByName[ns.name] = propsByName[ns.localName] = p;
    };
    DescriptorBuilder.prototype.removeNamedProperty = function(p) {
      var ns = p.ns, propsByName = this.propertiesByName;
      delete propsByName[ns.name];
      delete propsByName[ns.localName];
    };
    DescriptorBuilder.prototype.setBodyProperty = function(p, validate) {
      if (validate && this.bodyProperty) {
        throw new Error(
          "body property defined multiple times (<" + this.bodyProperty.ns.name + ">, <" + p.ns.name + ">)"
        );
      }
      this.bodyProperty = p;
    };
    DescriptorBuilder.prototype.setIdProperty = function(p, validate) {
      if (validate && this.idProperty) {
        throw new Error(
          "id property defined multiple times (<" + this.idProperty.ns.name + ">, <" + p.ns.name + ">)"
        );
      }
      this.idProperty = p;
    };
    DescriptorBuilder.prototype.assertNotTrait = function(typeDescriptor) {
      const _extends = typeDescriptor.extends || [];
      if (_extends.length) {
        throw new Error(
          `cannot create <${typeDescriptor.name}> extending <${typeDescriptor.extends}>`
        );
      }
    };
    DescriptorBuilder.prototype.assertNotDefined = function(p, name2) {
      var propertyName = p.name, definedProperty = this.propertiesByName[propertyName];
      if (definedProperty) {
        throw new Error(
          "property <" + propertyName + "> already defined; override of <" + definedProperty.definedBy.ns.name + "#" + definedProperty.ns.name + "> by <" + p.definedBy.ns.name + "#" + p.ns.name + "> not allowed without redefines"
        );
      }
    };
    DescriptorBuilder.prototype.hasProperty = function(name2) {
      return this.propertiesByName[name2];
    };
    DescriptorBuilder.prototype.addTrait = function(t, inherited) {
      if (inherited) {
        this.assertNotTrait(t);
      }
      var typesByName = this.allTypesByName, types2 = this.allTypes;
      var typeName = t.name;
      if (typeName in typesByName) {
        return;
      }
      forEach(t.properties, bind(function(p) {
        p = assign({}, p, {
          name: p.ns.localName,
          inherited
        });
        Object.defineProperty(p, "definedBy", {
          value: t
        });
        var replaces = p.replaces, redefines = p.redefines;
        if (replaces || redefines) {
          this.redefineProperty(p, replaces || redefines, replaces);
        } else {
          if (p.isBody) {
            this.setBodyProperty(p);
          }
          if (p.isId) {
            this.setIdProperty(p);
          }
          this.addProperty(p);
        }
      }, this));
      types2.push(t);
      typesByName[typeName] = t;
    };
    Registry.prototype.getPackage = function(uriOrPrefix) {
      return this.packageMap[uriOrPrefix];
    };
    Registry.prototype.getPackages = function() {
      return this.packages;
    };
    Registry.prototype.registerPackage = function(pkg) {
      pkg = assign({}, pkg);
      var pkgMap = this.packageMap;
      ensureAvailable(pkgMap, pkg, "prefix");
      ensureAvailable(pkgMap, pkg, "uri");
      forEach(pkg.types, bind(function(descriptor) {
        this.registerType(descriptor, pkg);
      }, this));
      pkgMap[pkg.uri] = pkgMap[pkg.prefix] = pkg;
      this.packages.push(pkg);
    };
    Registry.prototype.registerType = function(type, pkg) {
      type = assign({}, type, {
        superClass: (type.superClass || []).slice(),
        extends: (type.extends || []).slice(),
        properties: (type.properties || []).slice(),
        meta: assign({}, type.meta || {})
      });
      var ns = parseName(type.name, pkg.prefix), name2 = ns.name, propertiesByName = /* @__PURE__ */ Object.create(null);
      forEach(type.properties, bind(function(p) {
        var propertyNs = parseName(p.name, ns.prefix), propertyName = propertyNs.name;
        if (!isBuiltIn(p.type)) {
          p.type = parseName(p.type, propertyNs.prefix).name;
        }
        assign(p, {
          ns: propertyNs,
          name: propertyName
        });
        propertiesByName[propertyName] = p;
      }, this));
      assign(type, {
        ns,
        name: name2,
        propertiesByName
      });
      forEach(type.extends, bind(function(extendsName) {
        var extendsNameNs = parseName(extendsName, ns.prefix);
        var extended = this.typeMap[extendsNameNs.name];
        extended.traits = extended.traits || [];
        extended.traits.push(name2);
      }, this));
      this.definePackage(type, pkg);
      this.typeMap[name2] = type;
    };
    Registry.prototype.mapTypes = function(nsName2, iterator, trait) {
      var type = isBuiltIn(nsName2.name) ? { name: nsName2.name } : this.typeMap[nsName2.name];
      var self = this;
      function traverse(cls, trait2) {
        var parentNs = parseName(cls, isBuiltIn(cls) ? "" : nsName2.prefix);
        self.mapTypes(parentNs, iterator, trait2);
      }
      function traverseTrait(cls) {
        return traverse(cls, true);
      }
      function traverseSuper(cls) {
        return traverse(cls, false);
      }
      if (!type) {
        throw new Error("unknown type <" + nsName2.name + ">");
      }
      forEach(type.superClass, trait ? traverseTrait : traverseSuper);
      iterator(type, !trait);
      forEach(type.traits, traverseTrait);
    };
    Registry.prototype.getEffectiveDescriptor = function(name2) {
      var nsName2 = parseName(name2);
      var builder = new DescriptorBuilder(nsName2);
      this.mapTypes(nsName2, function(type, inherited) {
        builder.addTrait(type, inherited);
      });
      var descriptor = builder.build();
      this.definePackage(descriptor, descriptor.allTypes[descriptor.allTypes.length - 1].$pkg);
      return descriptor;
    };
    Registry.prototype.definePackage = function(target, pkg) {
      this.properties.define(target, "$pkg", { value: pkg });
    };
    Properties.prototype.set = function(target, name2, value) {
      if (!isString(name2) || !name2.length) {
        throw new TypeError("property name must be a non-empty string");
      }
      var property = this.getProperty(target, name2);
      var propertyName = property && property.name;
      if (isUndefined2(value)) {
        if (property) {
          delete target[propertyName];
        } else {
          delete target.$attrs[stripGlobal(name2)];
        }
      } else {
        if (property) {
          if (propertyName in target) {
            target[propertyName] = value;
          } else {
            defineProperty(target, property, value);
          }
        } else {
          target.$attrs[stripGlobal(name2)] = value;
        }
      }
    };
    Properties.prototype.get = function(target, name2) {
      var property = this.getProperty(target, name2);
      if (!property) {
        return target.$attrs[stripGlobal(name2)];
      }
      var propertyName = property.name;
      if (!target[propertyName] && property.isMany) {
        defineProperty(target, property, []);
      }
      return target[propertyName];
    };
    Properties.prototype.define = function(target, name2, options) {
      if (!options.writable) {
        var value = options.value;
        options = assign({}, options, {
          get: function() {
            return value;
          }
        });
        delete options.value;
      }
      Object.defineProperty(target, name2, options);
    };
    Properties.prototype.defineDescriptor = function(target, descriptor) {
      this.define(target, "$descriptor", { value: descriptor });
    };
    Properties.prototype.defineModel = function(target, model) {
      this.define(target, "$model", { value: model });
    };
    Properties.prototype.getProperty = function(target, name2) {
      var model = this.model;
      var property = model.getPropertyDescriptor(target, name2);
      if (property) {
        return property;
      }
      if (name2.includes(":")) {
        return null;
      }
      const strict = model.config.strict;
      if (typeof strict !== "undefined") {
        const error3 = new TypeError(`unknown property <${name2}> on <${target.$type}>`);
        if (strict) {
          throw error3;
        } else {
          typeof console !== "undefined" && console.warn(error3);
        }
      }
      return null;
    };
    Moddle.prototype.create = function(descriptor, attrs) {
      var Type = this.getType(descriptor);
      if (!Type) {
        throw new Error("unknown type <" + descriptor + ">");
      }
      return new Type(attrs);
    };
    Moddle.prototype.getType = function(descriptor) {
      var cache = this.typeCache;
      var name2 = isString(descriptor) ? descriptor : descriptor.ns.name;
      var type = cache[name2];
      if (!type) {
        descriptor = this.registry.getEffectiveDescriptor(name2);
        type = cache[name2] = this.factory.createType(descriptor);
      }
      return type;
    };
    Moddle.prototype.createAny = function(name2, nsUri, properties) {
      var nameNs = parseName(name2);
      var element = {
        $type: name2,
        $instanceOf: function(type) {
          return type === this.$type;
        },
        get: function(key) {
          return this[key];
        },
        set: function(key, value) {
          set(this, [key], value);
        }
      };
      var descriptor = {
        name: name2,
        isGeneric: true,
        ns: {
          prefix: nameNs.prefix,
          localName: nameNs.localName,
          uri: nsUri
        }
      };
      this.properties.defineDescriptor(element, descriptor);
      this.properties.defineModel(element, this);
      this.properties.define(element, "get", { enumerable: false, writable: true });
      this.properties.define(element, "set", { enumerable: false, writable: true });
      this.properties.define(element, "$parent", { enumerable: false, writable: true });
      this.properties.define(element, "$instanceOf", { enumerable: false, writable: true });
      forEach(properties, function(a, key) {
        if (isObject(a) && a.value !== void 0) {
          element[a.name] = a.value;
        } else {
          element[key] = a;
        }
      });
      return element;
    };
    Moddle.prototype.getPackage = function(uriOrPrefix) {
      return this.registry.getPackage(uriOrPrefix);
    };
    Moddle.prototype.getPackages = function() {
      return this.registry.getPackages();
    };
    Moddle.prototype.getElementDescriptor = function(element) {
      return element.$descriptor;
    };
    Moddle.prototype.hasType = function(element, type) {
      if (type === void 0) {
        type = element;
        element = this;
      }
      var descriptor = element.$model.getElementDescriptor(element);
      return type in descriptor.allTypesByName;
    };
    Moddle.prototype.getPropertyDescriptor = function(element, property) {
      return this.getElementDescriptor(element).propertiesByName[property];
    };
    Moddle.prototype.getTypeDescriptor = function(type) {
      return this.registry.typeMap[type];
    };
  }
});

// node_modules/saxen/dist/index.js
function replaceEntities(_, d, x, z) {
  if (z) {
    if (hasOwnProperty.call(ENTITY_MAPPING, z)) {
      return ENTITY_MAPPING[z];
    } else {
      return "&" + z + ";";
    }
  }
  if (d) {
    return fromCharCode(d);
  }
  return fromCharCode(parseInt(x, 16));
}
function decodeEntities(s) {
  if (s.length > 3 && s.indexOf("&") !== -1) {
    return s.replace(ENTITY_PATTERN, replaceEntities);
  }
  return s;
}
function error(msg) {
  return new Error(msg);
}
function missingNamespaceForPrefix(prefix2) {
  return "missing namespace for prefix <" + prefix2 + ">";
}
function getter(getFn) {
  return {
    "get": getFn,
    "enumerable": true
  };
}
function setNsEntry(nsMatrix, changes, key, value) {
  if (!(key in changes)) {
    changes[key] = key in nsMatrix ? nsMatrix[key] : null;
  }
  nsMatrix[key] = value;
}
function restoreNsMatrix(nsMatrix, changes) {
  var key, value;
  for (key in changes) {
    value = changes[key];
    if (value === null) {
      delete nsMatrix[key];
    } else {
      nsMatrix[key] = value;
    }
  }
}
function uriPrefix(prefix2) {
  return prefix2 + "$uri";
}
function buildNsMatrix(nsUriToPrefix) {
  var nsMatrix = /* @__PURE__ */ Object.create(null), uri2, prefix2;
  for (uri2 in nsUriToPrefix) {
    prefix2 = nsUriToPrefix[uri2];
    nsMatrix[prefix2] = prefix2;
    nsMatrix[uriPrefix(prefix2)] = uri2;
  }
  return nsMatrix;
}
function noopGetContext() {
  return { line: 0, column: 0 };
}
function throwFunc(err) {
  throw err;
}
function Parser(options) {
  if (!this) {
    return new Parser(options);
  }
  var proxy = options && options["proxy"];
  var onText, onOpenTag, onCloseTag, onCDATA, onError = throwFunc, onWarning, onComment, onQuestion, onAttention;
  var getContext = noopGetContext;
  var streaming = false;
  var rootTagFound = false;
  var leftoverXml = "";
  var maybeNS = false;
  var isNamespace = false;
  var returnError = null;
  var parseStop = false;
  var nsChangesStack, nsMatrix, nodeStack;
  var nsUriToPrefix;
  function handleError(err) {
    if (!(err instanceof Error)) {
      err = error(err);
    }
    returnError = err;
    onError(err, getContext);
  }
  function handleWarning(err) {
    if (!onWarning) {
      return;
    }
    if (!(err instanceof Error)) {
      err = error(err);
    }
    onWarning(err, getContext);
  }
  this["on"] = function(name2, cb) {
    if (typeof cb !== "function") {
      throw error("required args <name, cb>");
    }
    switch (name2) {
      case "openTag":
        onOpenTag = cb;
        break;
      case "text":
        onText = cb;
        break;
      case "closeTag":
        onCloseTag = cb;
        break;
      case "error":
        onError = cb;
        break;
      case "warn":
        onWarning = cb;
        break;
      case "cdata":
        onCDATA = cb;
        break;
      case "attention":
        onAttention = cb;
        break;
      // <!XXXXX zzzz="eeee">
      case "question":
        onQuestion = cb;
        break;
      // <? ....  ?>
      case "comment":
        onComment = cb;
        break;
      default:
        throw error("unsupported event: " + name2);
    }
    return this;
  };
  this["ns"] = function(nsMap) {
    if (typeof nsMap === "undefined") {
      nsMap = {};
    }
    if (typeof nsMap !== "object") {
      throw error("required args <nsMap={}>");
    }
    var _nsUriToPrefix = /* @__PURE__ */ Object.create(null), k;
    for (k in nsMap) {
      _nsUriToPrefix[k] = nsMap[k];
    }
    isNamespace = true;
    nsUriToPrefix = _nsUriToPrefix;
    return this;
  };
  function resetState() {
    nsChangesStack = isNamespace ? [] : null;
    nsMatrix = isNamespace ? buildNsMatrix(nsUriToPrefix) : null;
    nodeStack = [];
    getContext = noopGetContext;
    parseStop = false;
    returnError = null;
    rootTagFound = false;
    leftoverXml = "";
  }
  this["parse"] = function(xml3) {
    if (typeof xml3 !== "string") {
      throw error("required args <xml=string>");
    }
    if (streaming) {
      throw error("parse during stream; call end() first");
    }
    resetState();
    parse(xml3);
    getContext = noopGetContext;
    parseStop = false;
    return returnError;
  };
  this["write"] = function(xml3) {
    if (typeof xml3 !== "string") {
      throw error("required args <xml=string>");
    }
    if (!streaming) {
      resetState();
      streaming = true;
    }
    if (!returnError) {
      leftoverXml = parse(leftoverXml + xml3, true) || "";
    }
    return this;
  };
  this["end"] = function() {
    if (!streaming) {
      resetState();
    }
    streaming = false;
    if (!returnError) {
      parse(leftoverXml);
    }
    leftoverXml = "";
    getContext = noopGetContext;
    parseStop = false;
    return returnError;
  };
  this["stop"] = function() {
    parseStop = true;
  };
  function parse(xml3, streaming2 = false) {
    var elNameCache = null;
    var nsChanges, nsSnapshot, anonymousNsCount = 0, tagStart = false, tagEnd = false, i = 0, j = 0, x, y, q, w, v, xmlns, elementName, _elementName, elementProxy;
    var attrsString = "", attrsStart = 0, cachedAttrs;
    function normalizeAttrName(name2, defaultAlias) {
      var w2 = name2.indexOf(":");
      if (w2 === -1) {
        return name2;
      }
      var nsName2 = nsMatrix[name2.substring(0, w2)];
      if (!nsName2) {
        handleWarning(missingNamespaceForPrefix(name2.substring(0, w2)));
        return null;
      }
      return defaultAlias === nsName2 ? name2.substr(w2 + 1) : nsName2 + name2.substr(w2);
    }
    function getAttrs() {
      if (cachedAttrs !== null) {
        return cachedAttrs;
      }
      var nsUri, nsUriPrefix, defaultAlias = isNamespace && nsMatrix["xmlns"], attrList = isNamespace && maybeNS ? [] : null, i2 = attrsStart, s = attrsString, l = s.length, newalias, value, alias, name2, attrs = {}, seenAttrs = /* @__PURE__ */ new Set(), skipAttr, w2, j2;
      parseAttr:
        for (; i2 < l; i2++) {
          skipAttr = false;
          w2 = s.charCodeAt(i2);
          if (w2 === 32 || w2 < 14 && w2 > 8) {
            continue;
          }
          if (w2 < 65 || w2 > 122 || w2 > 90 && w2 < 97) {
            if (w2 !== 95 && w2 !== 58) {
              handleWarning("illegal first char attribute name");
              skipAttr = true;
            }
          }
          for (j2 = i2 + 1; j2 < l; j2++) {
            w2 = s.charCodeAt(j2);
            if (w2 > 96 && w2 < 123 || w2 > 64 && w2 < 91 || w2 > 47 && w2 < 59 || w2 === 46 || // '.'
            w2 === 45 || // '-'
            w2 === 95) {
              continue;
            }
            if (w2 === 32 || w2 < 14 && w2 > 8) {
              handleWarning("missing attribute value");
              i2 = j2;
              continue parseAttr;
            }
            if (w2 === 61) {
              break;
            }
            handleWarning("illegal attribute name char");
            skipAttr = true;
          }
          name2 = s.substring(i2, j2);
          if (name2 === "xmlns:xmlns") {
            handleWarning("illegal declaration of xmlns");
            skipAttr = true;
          }
          w2 = s.charCodeAt(j2 + 1);
          if (w2 === 34) {
            j2 = s.indexOf('"', i2 = j2 + 2);
            if (j2 === -1) {
              j2 = s.indexOf("'", i2);
              if (j2 !== -1) {
                handleWarning("attribute value quote missmatch");
                skipAttr = true;
              }
            }
          } else if (w2 === 39) {
            j2 = s.indexOf("'", i2 = j2 + 2);
            if (j2 === -1) {
              j2 = s.indexOf('"', i2);
              if (j2 !== -1) {
                handleWarning("attribute value quote missmatch");
                skipAttr = true;
              }
            }
          } else {
            handleWarning("missing attribute value quotes");
            skipAttr = true;
            for (j2 = j2 + 1; j2 < l; j2++) {
              w2 = s.charCodeAt(j2 + 1);
              if (w2 === 32 || w2 < 14 && w2 > 8) {
                break;
              }
            }
          }
          if (j2 === -1) {
            handleWarning("missing closing quotes");
            j2 = l;
            skipAttr = true;
          }
          if (!skipAttr) {
            value = s.substring(i2, j2);
          }
          if (name2 === "xmlns:xml" && value !== "http://www.w3.org/XML/1998/namespace") {
            handleError("illegal value of xmlns:xml");
          }
          i2 = j2;
          for (; j2 + 1 < l; j2++) {
            w2 = s.charCodeAt(j2 + 1);
            if (w2 === 32 || w2 < 14 && w2 > 8) {
              break;
            }
            if (i2 === j2) {
              handleWarning("illegal character after attribute end");
              skipAttr = true;
            }
          }
          i2 = j2 + 1;
          if (skipAttr) {
            continue parseAttr;
          }
          if (seenAttrs.has(name2)) {
            handleWarning("attribute <" + name2 + "> already defined");
            continue;
          }
          seenAttrs.add(name2);
          if (!isNamespace) {
            attrs[name2] = value;
            continue;
          }
          if (maybeNS) {
            newalias = name2 === "xmlns" ? "xmlns" : name2.charCodeAt(0) === 120 && name2.substr(0, 6) === "xmlns:" ? name2.substr(6) : null;
            if (newalias !== null) {
              nsUri = decodeEntities(value);
              nsUriPrefix = uriPrefix(newalias);
              alias = nsUriToPrefix[nsUri];
              if (!alias) {
                if (newalias === "xmlns" || nsUriPrefix in nsMatrix && nsMatrix[nsUriPrefix] !== nsUri) {
                  do {
                    alias = "ns" + anonymousNsCount++;
                  } while (typeof nsMatrix[alias] !== "undefined");
                } else {
                  alias = newalias;
                }
                nsUriToPrefix[nsUri] = alias;
              }
              if (nsMatrix[newalias] !== alias) {
                if (!nsChanges) {
                  nsChanges = /* @__PURE__ */ Object.create(null);
                }
                elNameCache = null;
                nsSnapshot = null;
                setNsEntry(nsMatrix, nsChanges, newalias, alias);
                if (newalias === "xmlns") {
                  setNsEntry(nsMatrix, nsChanges, uriPrefix(alias), nsUri);
                  defaultAlias = alias;
                }
                setNsEntry(nsMatrix, nsChanges, nsUriPrefix, nsUri);
              }
              attrs[name2] = value;
              continue;
            }
            attrList.push(name2, value);
            continue;
          }
          name2 = normalizeAttrName(name2, defaultAlias);
          if (name2 === null) {
            continue;
          }
          attrs[name2] = value;
        }
      if (maybeNS) {
        for (i2 = 0, l = attrList.length; i2 < l; i2++) {
          name2 = normalizeAttrName(attrList[i2++], defaultAlias);
          value = attrList[i2];
          if (name2 === null) {
            continue;
          }
          attrs[name2] = value;
        }
      }
      return cachedAttrs = attrs;
    }
    function getParseContext() {
      var splitsRe = /(\r\n|\r|\n)/g;
      var line = 0;
      var column = 0;
      var startOfLine = 0;
      var endOfLine = j;
      var match;
      var data;
      while (i >= startOfLine) {
        match = splitsRe.exec(xml3);
        if (!match) {
          break;
        }
        endOfLine = match[0].length + match.index;
        if (endOfLine > i) {
          break;
        }
        line += 1;
        startOfLine = endOfLine;
      }
      if (i == -1) {
        column = endOfLine;
        data = xml3.substring(j);
      } else if (j === 0) {
        data = xml3.substring(j, i);
      } else {
        column = i - startOfLine;
        data = j == -1 ? xml3.substring(i) : xml3.substring(i, j + 1);
      }
      return {
        "data": data,
        "line": line,
        "column": column
      };
    }
    getContext = getParseContext;
    if (proxy) {
      elementProxy = Object.create({}, {
        "name": getter(function() {
          return elementName;
        }),
        "originalName": getter(function() {
          return _elementName;
        }),
        "attrs": getter(getAttrs),
        "ns": getter(function() {
          if (!nsSnapshot) {
            nsSnapshot = Object.assign(/* @__PURE__ */ Object.create(null), nsMatrix);
          }
          return nsSnapshot;
        })
      });
    }
    while (j !== -1) {
      if (xml3.charCodeAt(j) === 60) {
        i = j;
      } else {
        i = xml3.indexOf("<", j);
      }
      if (i === -1) {
        if (streaming2) {
          return xml3.substring(j);
        }
        if (nodeStack.length) {
          return handleError("unexpected end of file");
        }
        if (!rootTagFound) {
          return handleError("missing start tag");
        }
        if (j < xml3.length) {
          if (xml3.substring(j).trim()) {
            handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);
          }
        }
        return;
      }
      if (!rootTagFound) {
        rootTagFound = true;
      }
      if (j !== i) {
        if (nodeStack.length) {
          if (onText) {
            onText(xml3.substring(j, i), decodeEntities, getContext);
            if (parseStop) {
              return;
            }
          }
        } else {
          if (xml3.substring(j, i).trim()) {
            handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);
            if (parseStop) {
              return;
            }
          }
        }
      }
      w = xml3.charCodeAt(i + 1);
      if (w === 33) {
        q = xml3.charCodeAt(i + 2);
        if (q === 91 && xml3.substr(i + 3, 6) === "CDATA[") {
          j = xml3.indexOf("]]>", i);
          if (j === -1) {
            if (streaming2) {
              return xml3.substring(i);
            }
            return handleError("unclosed cdata");
          }
          if (onCDATA) {
            onCDATA(xml3.substring(i + 9, j), getContext);
            if (parseStop) {
              return;
            }
          }
          j += 3;
          continue;
        }
        if (q === 45 && xml3.charCodeAt(i + 3) === 45) {
          j = xml3.indexOf("-->", i);
          if (j === -1) {
            if (streaming2) {
              return xml3.substring(i);
            }
            return handleError("unclosed comment");
          }
          if (onComment) {
            onComment(xml3.substring(i + 4, j), decodeEntities, getContext);
            if (parseStop) {
              return;
            }
          }
          j += 3;
          continue;
        }
      }
      if (w === 63) {
        j = xml3.indexOf("?>", i);
        if (j === -1) {
          if (streaming2) {
            return xml3.substring(i);
          }
          return handleError("unclosed question");
        }
        if (onQuestion) {
          onQuestion(xml3.substring(i, j + 2), getContext);
          if (parseStop) {
            return;
          }
        }
        j += 2;
        continue;
      }
      for (x = i + 1; ; x++) {
        v = xml3.charCodeAt(x);
        if (isNaN(v)) {
          if (streaming2) {
            return xml3.substring(i);
          }
          j = -1;
          return handleError("unclosed tag");
        }
        if (v === 34) {
          q = xml3.indexOf('"', x + 1);
          x = q !== -1 ? q : x;
        } else if (v === 39) {
          q = xml3.indexOf("'", x + 1);
          x = q !== -1 ? q : x;
        } else if (v === 62) {
          j = x;
          break;
        }
      }
      if (w === 33) {
        if (onAttention) {
          onAttention(xml3.substring(i, j + 1), decodeEntities, getContext);
          if (parseStop) {
            return;
          }
        }
        j += 1;
        continue;
      }
      cachedAttrs = {};
      if (w === 47) {
        tagStart = false;
        tagEnd = true;
        if (!nodeStack.length) {
          return handleError("missing open tag");
        }
        x = elementName = nodeStack.pop();
        q = i + 2 + x.length;
        if (xml3.substring(i + 2, q) !== x) {
          return handleError("closing tag mismatch");
        }
        for (; q < j; q++) {
          w = xml3.charCodeAt(q);
          if (w === 32 || w > 8 && w < 14) {
            continue;
          }
          return handleError("close tag");
        }
      } else {
        if (xml3.charCodeAt(j - 1) === 47) {
          x = elementName = xml3.substring(i + 1, j - 1);
          tagStart = true;
          tagEnd = true;
        } else {
          x = elementName = xml3.substring(i + 1, j);
          tagStart = true;
          tagEnd = false;
        }
        if (!(w > 96 && w < 123 || w > 64 && w < 91 || w === 95 || w === 58)) {
          return handleError("illegal first char nodeName");
        }
        for (q = 1, y = x.length; q < y; q++) {
          w = x.charCodeAt(q);
          if (w > 96 && w < 123 || w > 64 && w < 91 || w > 47 && w < 59 || w === 45 || w === 95 || w == 46) {
            continue;
          }
          if (w === 32 || w < 14 && w > 8) {
            elementName = x.substring(0, q);
            cachedAttrs = null;
            break;
          }
          return handleError("invalid nodeName");
        }
        if (!tagEnd) {
          nodeStack.push(elementName);
        }
      }
      if (isNamespace) {
        if (tagStart) {
          nsChanges = null;
          if (cachedAttrs === null) {
            if (maybeNS = x.indexOf("xmlns", q) !== -1) {
              attrsStart = q;
              attrsString = x;
              getAttrs();
              maybeNS = false;
            }
          }
          if (!tagEnd) {
            nsChangesStack.push(nsChanges);
          }
        }
        _elementName = elementName;
        if (elNameCache === null) {
          elNameCache = /* @__PURE__ */ Object.create(null);
        }
        var _cachedName = elNameCache[elementName];
        if (_cachedName !== void 0) {
          elementName = _cachedName;
        } else {
          w = elementName.indexOf(":");
          if (w !== -1) {
            xmlns = nsMatrix[elementName.substring(0, w)];
            if (!xmlns) {
              return handleError("missing namespace on <" + _elementName + ">");
            }
            elementName = elementName.substr(w + 1);
          } else {
            xmlns = nsMatrix["xmlns"];
          }
          if (xmlns) {
            elementName = xmlns + ":" + elementName;
          }
          elNameCache[_elementName] = elementName;
        }
      }
      if (tagStart) {
        attrsStart = q;
        attrsString = x;
        if (onOpenTag) {
          if (proxy) {
            onOpenTag(elementProxy, decodeEntities, tagEnd, getContext);
          } else {
            onOpenTag(elementName, getAttrs, decodeEntities, tagEnd, getContext);
          }
          if (parseStop) {
            return;
          }
        }
      }
      if (tagEnd) {
        if (onCloseTag) {
          onCloseTag(proxy ? elementProxy : elementName, decodeEntities, tagStart, getContext);
          if (parseStop) {
            return;
          }
        }
        if (isNamespace) {
          if (!tagStart) {
            nsChanges = nsChangesStack.pop();
          }
          if (nsChanges) {
            restoreNsMatrix(nsMatrix, nsChanges);
            nsChanges = null;
            elNameCache = null;
            nsSnapshot = null;
          }
        }
      }
      j += 1;
    }
  }
}
var fromCharCode, hasOwnProperty, ENTITY_PATTERN, ENTITY_MAPPING, NON_WHITESPACE_OUTSIDE_ROOT_NODE;
var init_dist3 = __esm({
  "node_modules/saxen/dist/index.js"() {
    fromCharCode = String.fromCharCode;
    hasOwnProperty = Object.prototype.hasOwnProperty;
    ENTITY_PATTERN = /&#(\d+);|&#x([0-9a-f]+);|&(\w+);/ig;
    ENTITY_MAPPING = {
      "amp": "&",
      "apos": "'",
      "gt": ">",
      "lt": "<",
      "quot": '"'
    };
    Object.keys(ENTITY_MAPPING).forEach(function(k) {
      ENTITY_MAPPING[k.toUpperCase()] = ENTITY_MAPPING[k];
    });
    NON_WHITESPACE_OUTSIDE_ROOT_NODE = "non-whitespace outside of root node";
  }
});

// node_modules/moddle-xml/dist/index.js
function hasLowerCaseAlias(pkg) {
  return pkg.xml && pkg.xml.tagAlias === "lowerCase";
}
function getSerialization(element) {
  return element.xml && element.xml.serialize;
}
function getSerializationType(element) {
  const type = getSerialization(element);
  return type !== SERIALIZE_PROPERTY && (type || null);
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function aliasToName(aliasNs, pkg) {
  if (!hasLowerCaseAlias(pkg)) {
    return aliasNs.name;
  }
  return aliasNs.prefix + ":" + capitalize(aliasNs.localName);
}
function prefixedToName(nameNs, pkg) {
  var name2 = nameNs.name, localName = nameNs.localName;
  var typePrefix = pkg && pkg.xml && pkg.xml.typePrefix;
  if (typePrefix && localName.indexOf(typePrefix) === 0) {
    return nameNs.prefix + ":" + localName.slice(typePrefix.length);
  } else {
    return name2;
  }
}
function normalizeTypeName(name2, nsMap, model) {
  const nameNs = parseName(name2, nsMap.xmlns);
  const normalizedName = `${nsMap[nameNs.prefix] || nameNs.prefix}:${nameNs.localName}`;
  const normalizedNameNs = parseName(normalizedName);
  var pkg = model.getPackage(normalizedNameNs.prefix);
  return prefixedToName(normalizedNameNs, pkg);
}
function error2(message) {
  return new Error(message);
}
function getModdleDescriptor(element) {
  return element.$descriptor;
}
function Context(options) {
  assign(this, options);
  this.elementsById = /* @__PURE__ */ Object.create(null);
  this.references = [];
  this.warnings = [];
  this.addReference = function(reference) {
    this.references.push(reference);
  };
  this.addElement = function(element) {
    if (!element) {
      throw error2("expected element");
    }
    var elementsById = this.elementsById;
    var descriptor = getModdleDescriptor(element);
    var idProperty = descriptor.idProperty, id;
    if (idProperty) {
      id = element.get(idProperty.name);
      if (id) {
        if (!/^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i.test(id)) {
          throw new Error("illegal ID <" + id + ">");
        }
        if (elementsById[id]) {
          throw error2("duplicate ID <" + id + ">");
        }
        elementsById[id] = element;
      }
    }
  };
  this.addWarning = function(warning) {
    this.warnings.push(warning);
  };
}
function BaseHandler() {
}
function NoopHandler() {
}
function BodyHandler() {
}
function ReferenceHandler(property, context) {
  this.property = property;
  this.context = context;
}
function ValueHandler(propertyDesc, element) {
  this.element = element;
  this.propertyDesc = propertyDesc;
}
function BaseElementHandler() {
}
function ElementHandler(model, typeName, context) {
  this.model = model;
  this.type = model.getType(typeName);
  this.context = context;
}
function RootElementHandler(model, typeName, context) {
  ElementHandler.call(this, model, typeName, context);
}
function GenericElementHandler(model, typeName, context) {
  this.model = model;
  this.context = context;
}
function Reader(options) {
  if (options instanceof Moddle) {
    options = {
      model: options
    };
  }
  assign(this, { lax: false }, options);
}
function createStack() {
  var stack = [];
  Object.defineProperty(stack, "peek", {
    value: function() {
      return this[this.length - 1];
    }
  });
  return stack;
}
function Namespaces(parent) {
  this.prefixMap = {};
  this.uriMap = {};
  this.used = {};
  this.wellknown = [];
  this.custom = [];
  this.parent = parent;
  this.defaultPrefixMap = parent && parent.defaultPrefixMap || {};
}
function lower(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}
function nameToAlias(name2, pkg) {
  if (hasLowerCaseAlias(pkg)) {
    return lower(name2);
  } else {
    return name2;
  }
}
function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
}
function nsName(ns) {
  if (isString(ns)) {
    return ns;
  } else {
    return (ns.prefix ? ns.prefix + ":" : "") + ns.localName;
  }
}
function getNsAttrs(namespaces) {
  return namespaces.getUsed().filter(function(ns) {
    return ns.prefix !== "xml";
  }).map(function(ns) {
    var name2 = "xmlns" + (ns.prefix ? ":" + ns.prefix : "");
    return { name: name2, value: escapeAttr(ns.uri) };
  });
}
function getElementNs(ns, descriptor) {
  if (descriptor.isGeneric) {
    return assign({ localName: descriptor.ns.localName }, ns);
  } else {
    return assign({ localName: nameToAlias(descriptor.ns.localName, descriptor.$pkg) }, ns);
  }
}
function getPropertyNs(ns, descriptor) {
  return assign({ localName: descriptor.ns.localName }, ns);
}
function getSerializableProperties(element) {
  var descriptor = element.$descriptor;
  return filter(descriptor.properties, function(p) {
    var name2 = p.name;
    if (p.isVirtual) {
      return false;
    }
    if (!has(element, name2)) {
      return false;
    }
    var value = element[name2];
    if (value === p.default) {
      return false;
    }
    if (value === null) {
      return false;
    }
    return p.isMany ? value.length : true;
  });
}
function escape(str, charPattern, replaceMap) {
  str = isString(str) ? str : "" + str;
  return str.replace(charPattern, function(s) {
    return "&" + replaceMap[s] + ";";
  });
}
function escapeAttr(str) {
  return escape(str, ESCAPE_ATTR_CHARS, ESCAPE_ATTR_MAP);
}
function escapeBody(str) {
  return escape(str, ESCAPE_CHARS, ESCAPE_MAP);
}
function filterAttributes(props) {
  return filter(props, function(p) {
    return p.isAttr;
  });
}
function filterContained(props) {
  return filter(props, function(p) {
    return !p.isAttr;
  });
}
function ReferenceSerializer(tagName) {
  this.tagName = tagName;
}
function BodySerializer() {
}
function ValueSerializer(tagName) {
  this.tagName = tagName;
}
function ElementSerializer(parent, propertyDescriptor) {
  this.body = [];
  this.attrs = [];
  this.parent = parent;
  this.propertyDescriptor = propertyDescriptor;
}
function serializeTree(root, writer) {
  var stack = [{ serializer: root, index: 0, opened: false, indent: false }];
  while (stack.length) {
    var frame = stack[stack.length - 1], serializer = frame.serializer;
    if (!frame.opened) {
      var firstBody = serializer.body[0];
      frame.indent = firstBody && firstBody.constructor !== BodySerializer;
      writer.appendIndent().append("<" + serializer.tagName);
      serializer.serializeAttributes(writer);
      writer.append(firstBody ? ">" : " />");
      frame.opened = true;
      if (!firstBody) {
        writer.appendNewLine();
        stack.pop();
        continue;
      }
      if (frame.indent) {
        writer.appendNewLine().indent();
      }
    }
    if (frame.index < serializer.body.length) {
      var child = serializer.body[frame.index++];
      if (child instanceof ElementSerializer) {
        stack.push({ serializer: child, index: 0, opened: false, indent: false });
      } else {
        child.serializeTo(writer);
      }
      continue;
    }
    if (frame.indent) {
      writer.unindent().appendIndent();
    }
    writer.append("</" + serializer.tagName + ">").appendNewLine();
    stack.pop();
  }
}
function TypeSerializer(parent, propertyDescriptor, serialization) {
  ElementSerializer.call(this, parent, propertyDescriptor);
  this.serialization = serialization;
}
function SavingWriter() {
  this.value = "";
  this.write = function(str) {
    this.value += str;
  };
}
function FormatingWriter(out, format) {
  var indent = [""];
  this.append = function(str) {
    out.write(str);
    return this;
  };
  this.appendNewLine = function() {
    if (format) {
      out.write("\n");
    }
    return this;
  };
  this.appendIndent = function() {
    if (format) {
      out.write(indent.join("  "));
    }
    return this;
  };
  this.indent = function() {
    indent.push("");
    return this;
  };
  this.unindent = function() {
    indent.pop();
    return this;
  };
}
function Writer(options) {
  options = assign({ format: false, preamble: true }, options || {});
  function toXML(tree, writer) {
    var internalWriter = writer || new SavingWriter();
    var formatingWriter = new FormatingWriter(internalWriter, options.format);
    if (options.preamble) {
      formatingWriter.append(XML_PREAMBLE);
    }
    var serializer = new ElementSerializer();
    var model = tree.$model;
    serializer.getNamespaces().mapDefaultPrefixes(getDefaultPrefixMappings(model));
    serializer.build(tree).serializeTo(formatingWriter);
    if (!writer) {
      return internalWriter.value;
    }
  }
  return {
    toXML
  };
}
function buildTree(rootSerializer, rootElement) {
  var stack = [{
    serializer: rootSerializer,
    children: rootSerializer.enter(rootElement),
    index: 0
  }];
  while (stack.length) {
    var frame = stack[stack.length - 1];
    if (frame.index >= frame.children.length) {
      frame.serializer.exit();
      stack.pop();
      continue;
    }
    var child = frame.children[frame.index++];
    var childSerializer = child.create();
    frame.serializer.body.push(childSerializer);
    if (child.element) {
      stack.push({
        serializer: childSerializer,
        children: childSerializer.enter(child.element),
        index: 0
      });
    }
  }
}
function getDefaultPrefixMappings(model) {
  const nsMap = model.config && model.config.nsMap || {};
  const prefixMap = {};
  for (const prefix2 in DEFAULT_NS_MAP) {
    prefixMap[prefix2] = DEFAULT_NS_MAP[prefix2];
  }
  for (const uri2 in nsMap) {
    const prefix2 = nsMap[uri2];
    prefixMap[prefix2] = uri2;
  }
  for (const pkg of model.getPackages()) {
    prefixMap[pkg.prefix] = pkg.uri;
  }
  return prefixMap;
}
var DEFAULT_NS_MAP, SERIALIZE_PROPERTY, XML_PREAMBLE, ESCAPE_ATTR_CHARS, ESCAPE_CHARS, ESCAPE_ATTR_MAP, ESCAPE_MAP;
var init_dist4 = __esm({
  "node_modules/moddle-xml/dist/index.js"() {
    init_dist();
    init_dist3();
    init_dist2();
    DEFAULT_NS_MAP = {
      "xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xml": "http://www.w3.org/XML/1998/namespace"
    };
    SERIALIZE_PROPERTY = "property";
    BaseHandler.prototype.handleEnd = function() {
    };
    BaseHandler.prototype.handleText = function() {
    };
    BaseHandler.prototype.handleNode = function() {
    };
    NoopHandler.prototype = Object.create(BaseHandler.prototype);
    NoopHandler.prototype.handleNode = function() {
      return this;
    };
    BodyHandler.prototype = Object.create(BaseHandler.prototype);
    BodyHandler.prototype.handleText = function(text) {
      this.body = (this.body || "") + text;
    };
    ReferenceHandler.prototype = Object.create(BodyHandler.prototype);
    ReferenceHandler.prototype.handleNode = function(node) {
      if (this.element) {
        throw error2("expected no sub nodes");
      } else {
        this.element = this.createReference(node);
      }
      return this;
    };
    ReferenceHandler.prototype.handleEnd = function() {
      this.element.id = this.body;
    };
    ReferenceHandler.prototype.createReference = function(node) {
      return {
        property: this.property.ns.name,
        id: ""
      };
    };
    ValueHandler.prototype = Object.create(BodyHandler.prototype);
    ValueHandler.prototype.handleEnd = function() {
      var value = this.body || "", element = this.element, propertyDesc = this.propertyDesc;
      value = coerceType(propertyDesc.type, value);
      if (propertyDesc.isMany) {
        element.get(propertyDesc.name).push(value);
      } else {
        element.set(propertyDesc.name, value);
      }
    };
    BaseElementHandler.prototype = Object.create(BodyHandler.prototype);
    BaseElementHandler.prototype.handleNode = function(node) {
      var parser = this, element = this.element;
      if (!element) {
        element = this.element = this.createElement(node);
        this.context.addElement(element);
      } else {
        parser = this.handleChild(node);
      }
      return parser;
    };
    ElementHandler.prototype = Object.create(BaseElementHandler.prototype);
    ElementHandler.prototype.addReference = function(reference) {
      this.context.addReference(reference);
    };
    ElementHandler.prototype.handleText = function(text) {
      var element = this.element, descriptor = getModdleDescriptor(element), bodyProperty = descriptor.bodyProperty;
      if (!bodyProperty) {
        throw error2("unexpected body text <" + text + ">");
      }
      BodyHandler.prototype.handleText.call(this, text);
    };
    ElementHandler.prototype.handleEnd = function() {
      var value = this.body, element = this.element, descriptor = getModdleDescriptor(element), bodyProperty = descriptor.bodyProperty;
      if (bodyProperty && value !== void 0) {
        value = coerceType(bodyProperty.type, value);
        element.set(bodyProperty.name, value);
      }
    };
    ElementHandler.prototype.createElement = function(node) {
      var attributes = node.attributes, Type = this.type, descriptor = getModdleDescriptor(Type), context = this.context, instance = new Type({}), model = this.model, propNameNs;
      forEach(attributes, function(value, name2) {
        var prop = descriptor.propertiesByName[name2], values;
        if (prop && prop.isReference) {
          if (!prop.isMany) {
            context.addReference({
              element: instance,
              property: prop.ns.name,
              id: value
            });
          } else {
            values = value.split(" ");
            forEach(values, function(v) {
              context.addReference({
                element: instance,
                property: prop.ns.name,
                id: v
              });
            });
          }
        } else {
          if (prop) {
            value = coerceType(prop.type, value);
          } else if (name2 === "xmlns") {
            name2 = ":" + name2;
          } else {
            propNameNs = parseName(name2, descriptor.ns.prefix);
            if (model.getPackage(propNameNs.prefix)) {
              context.addWarning({
                message: "unknown attribute <" + name2 + ">",
                element: instance,
                property: name2,
                value
              });
            }
          }
          instance.set(name2, value);
        }
      });
      return instance;
    };
    ElementHandler.prototype.getPropertyForNode = function(node) {
      var name2 = node.name;
      var nameNs = parseName(name2);
      var type = this.type, model = this.model, descriptor = getModdleDescriptor(type);
      var propertyName = nameNs.name, property = descriptor.propertiesByName[propertyName];
      if (property && !property.isAttr) {
        const serializationType = getSerializationType(property);
        if (serializationType) {
          const elementTypeName = node.attributes[serializationType];
          if (elementTypeName) {
            const normalizedTypeName = normalizeTypeName(elementTypeName, node.ns, model);
            const elementType = model.getType(normalizedTypeName);
            return assign({}, property, {
              effectiveType: getModdleDescriptor(elementType).name
            });
          }
        }
        return property;
      }
      var pkg = model.getPackage(nameNs.prefix);
      if (pkg) {
        const elementTypeName = aliasToName(nameNs, pkg);
        const elementType = model.getType(elementTypeName);
        property = find(descriptor.properties, function(p) {
          return !p.isVirtual && !p.isReference && !p.isAttribute && elementType.hasType(p.type);
        });
        if (property) {
          return assign({}, property, {
            effectiveType: getModdleDescriptor(elementType).name
          });
        }
      } else {
        property = find(descriptor.properties, function(p) {
          return !p.isReference && !p.isAttribute && p.type === "Element";
        });
        if (property) {
          return property;
        }
      }
      throw error2("unrecognized element <" + nameNs.name + ">");
    };
    ElementHandler.prototype.toString = function() {
      return "ElementDescriptor[" + getModdleDescriptor(this.type).name + "]";
    };
    ElementHandler.prototype.valueHandler = function(propertyDesc, element) {
      return new ValueHandler(propertyDesc, element);
    };
    ElementHandler.prototype.referenceHandler = function(propertyDesc) {
      return new ReferenceHandler(propertyDesc, this.context);
    };
    ElementHandler.prototype.handler = function(type) {
      if (type === "Element") {
        return new GenericElementHandler(this.model, type, this.context);
      } else {
        return new ElementHandler(this.model, type, this.context);
      }
    };
    ElementHandler.prototype.handleChild = function(node) {
      var propertyDesc, type, element, childHandler;
      propertyDesc = this.getPropertyForNode(node);
      element = this.element;
      type = propertyDesc.effectiveType || propertyDesc.type;
      if (isSimple(type)) {
        return this.valueHandler(propertyDesc, element);
      }
      if (propertyDesc.isReference) {
        childHandler = this.referenceHandler(propertyDesc).handleNode(node);
      } else {
        childHandler = this.handler(type).handleNode(node);
      }
      var newElement = childHandler.element;
      if (newElement !== void 0) {
        if (propertyDesc.isMany) {
          element.get(propertyDesc.name).push(newElement);
        } else {
          element.set(propertyDesc.name, newElement);
        }
        if (propertyDesc.isReference) {
          assign(newElement, {
            element
          });
          this.context.addReference(newElement);
        } else {
          newElement.$parent = element;
        }
      }
      return childHandler;
    };
    RootElementHandler.prototype = Object.create(ElementHandler.prototype);
    RootElementHandler.prototype.createElement = function(node) {
      var name2 = node.name, nameNs = parseName(name2), model = this.model, type = this.type, pkg = model.getPackage(nameNs.prefix), typeName = pkg && aliasToName(nameNs, pkg) || name2;
      if (!type.hasType(typeName)) {
        throw error2("unexpected element <" + node.originalName + ">");
      }
      return ElementHandler.prototype.createElement.call(this, node);
    };
    GenericElementHandler.prototype = Object.create(BaseElementHandler.prototype);
    GenericElementHandler.prototype.createElement = function(node) {
      var name2 = node.name, ns = parseName(name2), prefix2 = ns.prefix, uri2 = node.ns[prefix2 + "$uri"], attributes = node.attributes;
      return this.model.createAny(name2, uri2, attributes);
    };
    GenericElementHandler.prototype.handleChild = function(node) {
      var handler = new GenericElementHandler(this.model, "Element", this.context).handleNode(node), element = this.element;
      var newElement = handler.element, children;
      if (newElement !== void 0) {
        children = element.$children = element.$children || [];
        children.push(newElement);
        newElement.$parent = element;
      }
      return handler;
    };
    GenericElementHandler.prototype.handleEnd = function() {
      if (this.body) {
        this.element.$body = this.body;
      }
    };
    Reader.prototype.fromXML = function(xml3, options, done) {
      var rootHandler = options.rootHandler;
      if (options instanceof ElementHandler) {
        rootHandler = options;
        options = {};
      } else {
        if (typeof options === "string") {
          rootHandler = this.handler(options);
          options = {};
        } else if (typeof rootHandler === "string") {
          rootHandler = this.handler(rootHandler);
        }
      }
      var model = this.model, lax = this.lax;
      var context = new Context(assign({}, options, { rootHandler })), parser = new Parser({ proxy: true }), stack = createStack();
      rootHandler.context = context;
      stack.push(rootHandler);
      function handleError(err, getContext, lax2) {
        var ctx = getContext();
        var line = ctx.line, column = ctx.column, data = ctx.data;
        if (data.charAt(0) === "<" && data.indexOf(" ") !== -1) {
          data = data.slice(0, data.indexOf(" ")) + ">";
        }
        var message = "unparsable content " + (data ? data + " " : "") + "detected\n	line: " + line + "\n	column: " + column + "\n	nested error: " + err.message;
        if (lax2) {
          context.addWarning({
            message,
            error: err
          });
          return true;
        } else {
          throw error2(message);
        }
      }
      function handleWarning(err, getContext) {
        return handleError(err, getContext, true);
      }
      function resolveReferences() {
        var elementsById = context.elementsById;
        var references = context.references;
        var i, r;
        for (i = 0; r = references[i]; i++) {
          var element = r.element;
          var reference = elementsById[r.id];
          var property = getModdleDescriptor(element).propertiesByName[r.property];
          if (!reference) {
            context.addWarning({
              message: "unresolved reference <" + r.id + ">",
              element: r.element,
              property: r.property,
              value: r.id
            });
          }
          if (property.isMany) {
            var collection = element.get(property.name), idx = collection.indexOf(r);
            if (idx === -1) {
              idx = collection.length;
            }
            if (!reference) {
              collection.splice(idx, 1);
            } else {
              collection[idx] = reference;
            }
          } else {
            element.set(property.name, reference);
          }
        }
      }
      function handleClose() {
        stack.pop().handleEnd();
      }
      var PREAMBLE_START_PATTERN = /^<\?xml /i;
      var ENCODING_PATTERN = / encoding="([^"]+)"/i;
      var UTF_8_PATTERN = /^utf-8$/i;
      function handleQuestion(question) {
        if (!PREAMBLE_START_PATTERN.test(question)) {
          return;
        }
        var match = ENCODING_PATTERN.exec(question);
        var encoding = match && match[1];
        if (!encoding || UTF_8_PATTERN.test(encoding)) {
          return;
        }
        context.addWarning({
          message: "unsupported document encoding <" + encoding + ">, falling back to UTF-8"
        });
      }
      function handleOpen(node, getContext) {
        var handler = stack.peek();
        try {
          stack.push(handler.handleNode(node));
        } catch (err) {
          if (handleError(err, getContext, lax)) {
            stack.push(new NoopHandler());
          }
        }
      }
      function handleCData(text, getContext) {
        try {
          stack.peek().handleText(text);
        } catch (err) {
          handleWarning(err, getContext);
        }
      }
      function handleText(text, getContext) {
        if (!text.trim()) {
          return;
        }
        handleCData(text, getContext);
      }
      var uriMap = model.getPackages().reduce(function(uriMap2, p) {
        uriMap2[p.uri] = p.prefix;
        return uriMap2;
      }, Object.entries(DEFAULT_NS_MAP).reduce(function(map2, [prefix2, url]) {
        map2[url] = prefix2;
        return map2;
      }, model.config && model.config.nsMap || {}));
      parser.ns(uriMap).on("openTag", function(obj, decodeStr, selfClosing, getContext) {
        var attrs = obj.attrs || {};
        var decodedAttrs = Object.keys(attrs).reduce(function(d, key) {
          var value = decodeStr(attrs[key]);
          d[key] = value;
          return d;
        }, {});
        var node = {
          name: obj.name,
          originalName: obj.originalName,
          attributes: decodedAttrs,
          ns: obj.ns
        };
        handleOpen(node, getContext);
      }).on("question", handleQuestion).on("closeTag", handleClose).on("cdata", handleCData).on("text", function(text, decodeEntities2, getContext) {
        handleText(decodeEntities2(text), getContext);
      }).on("error", handleError).on("warn", handleWarning);
      return new Promise(function(resolve, reject) {
        var err;
        try {
          parser.parse(xml3);
          resolveReferences();
        } catch (e) {
          err = e;
        }
        var rootElement = rootHandler.element;
        if (!err && !rootElement) {
          err = error2("failed to parse document as <" + rootHandler.type.$descriptor.name + ">");
        }
        var warnings = context.warnings;
        var references = context.references;
        var elementsById = context.elementsById;
        if (err) {
          err.warnings = warnings;
          return reject(err);
        } else {
          return resolve({
            rootElement,
            elementsById,
            references,
            warnings
          });
        }
      });
    };
    Reader.prototype.handler = function(name2) {
      return new RootElementHandler(this.model, name2);
    };
    XML_PREAMBLE = '<?xml version="1.0" encoding="UTF-8"?>\n';
    ESCAPE_ATTR_CHARS = /<|>|'|"|&|\n\r|\n/g;
    ESCAPE_CHARS = /<|>|&/g;
    Namespaces.prototype.mapDefaultPrefixes = function(defaultPrefixMap) {
      this.defaultPrefixMap = defaultPrefixMap;
    };
    Namespaces.prototype.defaultUriByPrefix = function(prefix2) {
      return this.defaultPrefixMap[prefix2];
    };
    Namespaces.prototype.resolve = function(fn) {
      var scope = this;
      while (scope) {
        var resolved = fn(scope);
        if (resolved) {
          return resolved;
        }
        scope = scope.parent;
      }
    };
    Namespaces.prototype.eachScope = function(fn) {
      var scope = this;
      while (scope) {
        fn(scope);
        scope = scope.parent;
      }
    };
    Namespaces.prototype.byUri = function(uri2) {
      return this.resolve(function(scope) {
        return scope.uriMap[uri2];
      });
    };
    Namespaces.prototype.add = function(ns, isWellknown) {
      this.uriMap[ns.uri] = ns;
      if (isWellknown) {
        this.wellknown.push(ns);
      } else {
        this.custom.push(ns);
      }
      this.mapPrefix(ns.prefix, ns.uri);
    };
    Namespaces.prototype.uriByPrefix = function(prefix2) {
      var key = prefix2 || "xmlns";
      return this.resolve(function(scope) {
        return scope.prefixMap[key];
      });
    };
    Namespaces.prototype.mapPrefix = function(prefix2, uri2) {
      this.prefixMap[prefix2 || "xmlns"] = uri2;
    };
    Namespaces.prototype.getNSKey = function(ns) {
      return ns.prefix !== void 0 ? ns.uri + "|" + ns.prefix : ns.uri;
    };
    Namespaces.prototype.logUsed = function(ns) {
      var uri2 = ns.uri;
      var nsKey = this.getNSKey(ns);
      var resolved = this.byUri(uri2);
      this.eachScope(function(scope) {
        scope.used[nsKey] = resolved;
      });
    };
    Namespaces.prototype.getUsed = function(ns) {
      var allNs = [].concat(this.wellknown, this.custom);
      return allNs.filter((ns2) => {
        var nsKey = this.getNSKey(ns2);
        return this.used[nsKey];
      });
    };
    ESCAPE_ATTR_MAP = {
      "\n": "#10",
      "\n\r": "#10",
      '"': "#34",
      "'": "#39",
      "<": "#60",
      ">": "#62",
      "&": "#38"
    };
    ESCAPE_MAP = {
      "<": "lt",
      ">": "gt",
      "&": "amp"
    };
    ReferenceSerializer.prototype.build = function(element) {
      this.element = element;
      return this;
    };
    ReferenceSerializer.prototype.serializeTo = function(writer) {
      writer.appendIndent().append("<" + this.tagName + ">" + escapeBody(this.element.id) + "</" + this.tagName + ">").appendNewLine();
    };
    BodySerializer.prototype.serializeValue = BodySerializer.prototype.serializeTo = function(writer) {
      writer.append(
        this.escape ? escapeBody(this.value) : this.value
      );
    };
    BodySerializer.prototype.build = function(prop, value) {
      this.value = value;
      if (prop.type === "String" && value.search(ESCAPE_CHARS) !== -1) {
        this.escape = true;
      }
      return this;
    };
    inherits(ValueSerializer, BodySerializer);
    ValueSerializer.prototype.serializeTo = function(writer) {
      writer.appendIndent().append("<" + this.tagName + ">");
      this.serializeValue(writer);
      writer.append("</" + this.tagName + ">").appendNewLine();
    };
    ElementSerializer.prototype.build = function(element) {
      buildTree(this, element);
      return this;
    };
    ElementSerializer.prototype.enter = function(element) {
      this.element = element;
      var elementDescriptor = element.$descriptor, propertyDescriptor = this.propertyDescriptor;
      var isGeneric = elementDescriptor.isGeneric;
      if (isGeneric) {
        this.otherAttrs = this.parseGenericNsAttributes(element);
      } else {
        this.otherAttrs = this.parseNsAttributes(element);
      }
      if (propertyDescriptor) {
        this.ns = this.nsPropertyTagName(propertyDescriptor);
      } else {
        this.ns = this.nsTagName(elementDescriptor);
      }
      this.tagName = this.addTagName(this.ns);
      if (isGeneric) {
        return this.collectGenericContainments(element);
      }
      var properties = getSerializableProperties(element);
      this.parseAttributes(filterAttributes(properties));
      return this.collectContainments(filterContained(properties));
    };
    ElementSerializer.prototype.exit = function() {
      this.parseGenericAttributes(this.element, this.otherAttrs);
    };
    ElementSerializer.prototype.nsTagName = function(descriptor) {
      var effectiveNs = this.logNamespaceUsed(descriptor.ns);
      return getElementNs(effectiveNs, descriptor);
    };
    ElementSerializer.prototype.nsPropertyTagName = function(descriptor) {
      var effectiveNs = this.logNamespaceUsed(descriptor.ns);
      return getPropertyNs(effectiveNs, descriptor);
    };
    ElementSerializer.prototype.isLocalNs = function(ns) {
      return ns.uri === this.ns.uri;
    };
    ElementSerializer.prototype.nsAttributeName = function(element) {
      var ns;
      if (isString(element)) {
        ns = parseName(element);
      } else {
        ns = element.ns;
      }
      if (element.inherited) {
        return { localName: ns.localName };
      }
      var effectiveNs = this.logNamespaceUsed(ns);
      this.getNamespaces().logUsed(effectiveNs);
      if (this.isLocalNs(effectiveNs)) {
        return { localName: ns.localName };
      } else {
        return assign({ localName: ns.localName }, effectiveNs);
      }
    };
    ElementSerializer.prototype.parseGenericNsAttributes = function(element) {
      return Object.entries(element).filter(
        ([key, value]) => !key.startsWith("$") && this.parseNsAttribute(element, key, value)
      ).map(
        ([key, value]) => ({ name: key, value })
      );
    };
    ElementSerializer.prototype.collectGenericContainments = function(element) {
      var self = this, children = [];
      var bodyText = element.$body;
      if (bodyText) {
        children.push({
          create: function() {
            return new BodySerializer().build({ type: "String" }, bodyText);
          }
        });
      }
      var genericChildren = element.$children;
      if (genericChildren) {
        forEach(genericChildren, function(child) {
          children.push({
            create: function() {
              return new ElementSerializer(self);
            },
            element: child
          });
        });
      }
      return children;
    };
    ElementSerializer.prototype.parseNsAttribute = function(element, name2, value) {
      var model = element.$model;
      var nameNs = parseName(name2);
      var ns;
      if (nameNs.prefix === "xmlns") {
        ns = { prefix: nameNs.localName, uri: value };
      }
      if (!nameNs.prefix && nameNs.localName === "xmlns") {
        ns = { uri: value };
      }
      if (!ns) {
        return {
          name: name2,
          value
        };
      }
      if (model && model.getPackage(value)) {
        this.logNamespace(ns, true, true);
      } else {
        var actualNs = this.logNamespaceUsed(ns, true);
        this.getNamespaces().logUsed(actualNs);
      }
    };
    ElementSerializer.prototype.parseNsAttributes = function(element) {
      var self = this;
      var genericAttrs = element.$attrs;
      var attributes = [];
      forEach(genericAttrs, function(value, name2) {
        var nonNsAttr = self.parseNsAttribute(element, name2, value);
        if (nonNsAttr) {
          attributes.push(nonNsAttr);
        }
      });
      return attributes;
    };
    ElementSerializer.prototype.parseGenericAttributes = function(element, attributes) {
      var self = this;
      forEach(attributes, function(attr) {
        try {
          self.addAttribute(self.nsAttributeName(attr.name), attr.value);
        } catch (e) {
          typeof console !== "undefined" && console.warn(
            `missing namespace information for <${attr.name}=${attr.value}> on`,
            element,
            e
          );
        }
      });
    };
    ElementSerializer.prototype.collectContainments = function(properties) {
      var self = this, element = this.element, children = [];
      forEach(properties, function(p) {
        var value = element.get(p.name), isReference = p.isReference, isMany = p.isMany;
        if (!isMany) {
          value = [value];
        }
        if (p.isBody) {
          children.push({
            create: function() {
              return new BodySerializer().build(p, value[0]);
            }
          });
        } else if (isSimple(p.type)) {
          forEach(value, function(v) {
            children.push({
              create: function() {
                return new ValueSerializer(self.addTagName(self.nsPropertyTagName(p))).build(p, v);
              }
            });
          });
        } else if (isReference) {
          forEach(value, function(v) {
            children.push({
              create: function() {
                return new ReferenceSerializer(self.addTagName(self.nsPropertyTagName(p))).build(v);
              }
            });
          });
        } else {
          var serialization = getSerialization(p);
          forEach(value, function(v) {
            children.push({
              create: function() {
                if (serialization) {
                  if (serialization === SERIALIZE_PROPERTY) {
                    return new ElementSerializer(self, p);
                  }
                  return new TypeSerializer(self, p, serialization);
                }
                return new ElementSerializer(self);
              },
              element: v
            });
          });
        }
      });
      return children;
    };
    ElementSerializer.prototype.getNamespaces = function(local) {
      var namespaces = this.namespaces;
      if (!namespaces) {
        var parentNamespaces = this.getParentNamespaces();
        if (local || !parentNamespaces) {
          this.namespaces = namespaces = new Namespaces(parentNamespaces);
        } else {
          namespaces = parentNamespaces;
        }
      }
      return namespaces;
    };
    ElementSerializer.prototype.getParentNamespaces = function() {
      if (this.parentNamespaces !== void 0) {
        return this.parentNamespaces;
      }
      var scope = null, ancestor = this.parent;
      while (ancestor) {
        if (ancestor.namespaces) {
          scope = ancestor.namespaces;
          break;
        }
        if (ancestor.parentNamespaces !== void 0) {
          scope = ancestor.parentNamespaces;
          break;
        }
        ancestor = ancestor.parent;
      }
      return this.parentNamespaces = scope;
    };
    ElementSerializer.prototype.logNamespace = function(ns, wellknown, local) {
      var namespaces = this.getNamespaces(local);
      var nsUri = ns.uri, nsPrefix = ns.prefix;
      var existing = namespaces.byUri(nsUri);
      if (!existing || local) {
        namespaces.add(ns, wellknown);
      }
      namespaces.mapPrefix(nsPrefix, nsUri);
      return ns;
    };
    ElementSerializer.prototype.logNamespaceUsed = function(ns, local) {
      var namespaces = this.getNamespaces(local);
      var prefix2 = ns.prefix, uri2 = ns.uri, newPrefix, idx, wellknownUri;
      if (!prefix2 && !uri2) {
        return { localName: ns.localName };
      }
      wellknownUri = namespaces.defaultUriByPrefix(prefix2);
      uri2 = uri2 || wellknownUri || namespaces.uriByPrefix(prefix2);
      if (!uri2) {
        throw new Error("no namespace uri given for prefix <" + prefix2 + ">");
      }
      ns = namespaces.byUri(uri2);
      if (!ns && !prefix2) {
        ns = this.logNamespace({ uri: uri2 }, wellknownUri === uri2, true);
      }
      if (!ns) {
        newPrefix = prefix2;
        idx = 1;
        while (namespaces.uriByPrefix(newPrefix)) {
          newPrefix = prefix2 + "_" + idx++;
        }
        ns = this.logNamespace({ prefix: newPrefix, uri: uri2 }, wellknownUri === uri2);
      }
      if (prefix2) {
        namespaces.mapPrefix(prefix2, uri2);
      }
      return ns;
    };
    ElementSerializer.prototype.parseAttributes = function(properties) {
      var self = this, element = this.element;
      forEach(properties, function(p) {
        var value = element.get(p.name);
        if (p.isReference) {
          if (!p.isMany) {
            value = value.id;
          } else {
            var values = [];
            forEach(value, function(v) {
              values.push(v.id);
            });
            value = values.join(" ");
          }
        }
        self.addAttribute(self.nsAttributeName(p), value);
      });
    };
    ElementSerializer.prototype.addTagName = function(nsTagName) {
      var actualNs = this.logNamespaceUsed(nsTagName);
      this.getNamespaces().logUsed(actualNs);
      return nsName(nsTagName);
    };
    ElementSerializer.prototype.addAttribute = function(name2, value) {
      var attrs = this.attrs;
      if (isString(value)) {
        value = escapeAttr(value);
      }
      var idx = findIndex(attrs, function(element) {
        return element.name.localName === name2.localName && element.name.uri === name2.uri && element.name.prefix === name2.prefix;
      });
      var attr = { name: name2, value };
      if (idx !== -1) {
        attrs.splice(idx, 1, attr);
      } else {
        attrs.push(attr);
      }
    };
    ElementSerializer.prototype.serializeAttributes = function(writer) {
      var attrs = this.attrs, namespaces = this.namespaces;
      if (namespaces) {
        attrs = getNsAttrs(namespaces).concat(attrs);
      }
      forEach(attrs, function(a) {
        writer.append(" ").append(nsName(a.name)).append('="').append(a.value).append('"');
      });
    };
    ElementSerializer.prototype.serializeTo = function(writer) {
      serializeTree(this, writer);
    };
    inherits(TypeSerializer, ElementSerializer);
    TypeSerializer.prototype.parseNsAttributes = function(element) {
      var attributes = ElementSerializer.prototype.parseNsAttributes.call(this, element).filter(
        (attr) => attr.name !== this.serialization
      );
      var descriptor = element.$descriptor;
      if (descriptor.name === this.propertyDescriptor.type) {
        return attributes;
      }
      var typeNs = this.typeNs = this.nsTagName(descriptor);
      this.getNamespaces().logUsed(this.typeNs);
      var pkg = element.$model.getPackage(typeNs.uri), typePrefix = pkg.xml && pkg.xml.typePrefix || "";
      this.addAttribute(
        this.nsAttributeName(this.serialization),
        (typeNs.prefix ? typeNs.prefix + ":" : "") + typePrefix + descriptor.ns.localName
      );
      return attributes;
    };
    TypeSerializer.prototype.isLocalNs = function(ns) {
      return ns.uri === (this.typeNs || this.ns).uri;
    };
  }
});

// node_modules/bpmn-moddle/dist/index.js
function BpmnModdle(packages2, options) {
  Moddle.call(this, packages2, options);
}
function SimpleBpmnModdle(additionalPackages, options) {
  const pks = assign({}, packages, additionalPackages);
  return new BpmnModdle(pks, options);
}
var name$5, uri$5, prefix$5, associations$5, types$5, enumerations$3, xml$1, BpmnPackage, name$4, uri$4, prefix$4, types$4, enumerations$2, associations$4, BpmnDiPackage, name$3, uri$3, prefix$3, types$3, associations$3, DcPackage, name$2, uri$2, prefix$2, types$2, associations$2, xml, DiPackage, name$1, uri$1, prefix$1, types$1, enumerations$1, associations$1, BiocPackage, name, uri, prefix, types, enumerations, associations, BpmnInColorPackage, packages;
var init_dist5 = __esm({
  "node_modules/bpmn-moddle/dist/index.js"() {
    init_dist();
    init_dist2();
    init_dist4();
    BpmnModdle.prototype = Object.create(Moddle.prototype);
    BpmnModdle.prototype.fromXML = function(xmlStr, typeName, options) {
      if (!isString(typeName)) {
        options = typeName;
        typeName = "bpmn:Definitions";
      }
      var reader = new Reader(assign({ model: this, lax: true }, options));
      var rootHandler = reader.handler(typeName);
      return reader.fromXML(xmlStr, rootHandler);
    };
    BpmnModdle.prototype.toXML = function(element, options) {
      var writer = new Writer(options);
      return new Promise(function(resolve, reject) {
        try {
          var result = writer.toXML(element);
          return resolve({
            xml: result
          });
        } catch (err) {
          return reject(err);
        }
      });
    };
    name$5 = "BPMN20";
    uri$5 = "http://www.omg.org/spec/BPMN/20100524/MODEL";
    prefix$5 = "bpmn";
    associations$5 = [];
    types$5 = [
      {
        name: "Interface",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "operations",
            type: "Operation",
            isMany: true
          },
          {
            name: "implementationRef",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Operation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "inMessageRef",
            type: "Message",
            isReference: true
          },
          {
            name: "outMessageRef",
            type: "Message",
            isReference: true
          },
          {
            name: "errorRef",
            type: "Error",
            isMany: true,
            isReference: true
          },
          {
            name: "implementationRef",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "EndPoint",
        superClass: [
          "RootElement"
        ]
      },
      {
        name: "Auditing",
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "GlobalTask",
        superClass: [
          "CallableElement"
        ],
        properties: [
          {
            name: "resources",
            type: "ResourceRole",
            isMany: true
          }
        ]
      },
      {
        name: "Monitoring",
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "Performer",
        superClass: [
          "ResourceRole"
        ]
      },
      {
        name: "Process",
        superClass: [
          "FlowElementsContainer",
          "CallableElement"
        ],
        properties: [
          {
            name: "processType",
            type: "ProcessType",
            isAttr: true
          },
          {
            name: "isClosed",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "auditing",
            type: "Auditing"
          },
          {
            name: "monitoring",
            type: "Monitoring"
          },
          {
            name: "properties",
            type: "Property",
            isMany: true
          },
          {
            name: "laneSets",
            isMany: true,
            replaces: "FlowElementsContainer#laneSets",
            type: "LaneSet"
          },
          {
            name: "flowElements",
            isMany: true,
            replaces: "FlowElementsContainer#flowElements",
            type: "FlowElement"
          },
          {
            name: "artifacts",
            type: "Artifact",
            isMany: true
          },
          {
            name: "resources",
            type: "ResourceRole",
            isMany: true
          },
          {
            name: "correlationSubscriptions",
            type: "CorrelationSubscription",
            isMany: true
          },
          {
            name: "supports",
            type: "Process",
            isMany: true,
            isReference: true
          },
          {
            name: "definitionalCollaborationRef",
            type: "Collaboration",
            isAttr: true,
            isReference: true
          },
          {
            name: "isExecutable",
            isAttr: true,
            type: "Boolean"
          }
        ]
      },
      {
        name: "LaneSet",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "lanes",
            type: "Lane",
            isMany: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Lane",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "partitionElementRef",
            type: "BaseElement",
            isAttr: true,
            isReference: true
          },
          {
            name: "partitionElement",
            type: "BaseElement"
          },
          {
            name: "flowNodeRef",
            type: "FlowNode",
            isMany: true,
            isReference: true
          },
          {
            name: "childLaneSet",
            type: "LaneSet",
            xml: {
              serialize: "xsi:type"
            }
          }
        ]
      },
      {
        name: "GlobalManualTask",
        superClass: [
          "GlobalTask"
        ]
      },
      {
        name: "ManualTask",
        superClass: [
          "Task"
        ]
      },
      {
        name: "UserTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "renderings",
            type: "Rendering",
            isMany: true
          },
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Rendering",
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "HumanPerformer",
        superClass: [
          "Performer"
        ]
      },
      {
        name: "PotentialOwner",
        superClass: [
          "HumanPerformer"
        ]
      },
      {
        name: "GlobalUserTask",
        superClass: [
          "GlobalTask"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          },
          {
            name: "renderings",
            type: "Rendering",
            isMany: true
          }
        ]
      },
      {
        name: "Gateway",
        isAbstract: true,
        superClass: [
          "FlowNode"
        ],
        properties: [
          {
            name: "gatewayDirection",
            type: "GatewayDirection",
            "default": "Unspecified",
            isAttr: true
          }
        ]
      },
      {
        name: "EventBasedGateway",
        superClass: [
          "Gateway"
        ],
        properties: [
          {
            name: "instantiate",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "eventGatewayType",
            type: "EventBasedGatewayType",
            isAttr: true,
            "default": "Exclusive"
          }
        ]
      },
      {
        name: "ComplexGateway",
        superClass: [
          "Gateway"
        ],
        properties: [
          {
            name: "activationCondition",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "default",
            type: "SequenceFlow",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ExclusiveGateway",
        superClass: [
          "Gateway"
        ],
        properties: [
          {
            name: "default",
            type: "SequenceFlow",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "InclusiveGateway",
        superClass: [
          "Gateway"
        ],
        properties: [
          {
            name: "default",
            type: "SequenceFlow",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ParallelGateway",
        superClass: [
          "Gateway"
        ]
      },
      {
        name: "RootElement",
        isAbstract: true,
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "Relationship",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "type",
            isAttr: true,
            type: "String"
          },
          {
            name: "direction",
            type: "RelationshipDirection",
            isAttr: true
          },
          {
            name: "source",
            isMany: true,
            isReference: true,
            type: "Element"
          },
          {
            name: "target",
            isMany: true,
            isReference: true,
            type: "Element"
          }
        ]
      },
      {
        name: "BaseElement",
        isAbstract: true,
        properties: [
          {
            name: "id",
            isAttr: true,
            type: "String",
            isId: true
          },
          {
            name: "documentation",
            type: "Documentation",
            isMany: true
          },
          {
            name: "extensionDefinitions",
            type: "ExtensionDefinition",
            isMany: true,
            isReference: true
          },
          {
            name: "extensionElements",
            type: "ExtensionElements"
          }
        ]
      },
      {
        name: "Extension",
        properties: [
          {
            name: "mustUnderstand",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "definition",
            type: "ExtensionDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ExtensionDefinition",
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "extensionAttributeDefinitions",
            type: "ExtensionAttributeDefinition",
            isMany: true
          }
        ]
      },
      {
        name: "ExtensionAttributeDefinition",
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "type",
            isAttr: true,
            type: "String"
          },
          {
            name: "isReference",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "extensionDefinition",
            type: "ExtensionDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ExtensionElements",
        properties: [
          {
            name: "valueRef",
            isAttr: true,
            isReference: true,
            type: "Element"
          },
          {
            name: "values",
            type: "Element",
            isMany: true
          },
          {
            name: "extensionAttributeDefinition",
            type: "ExtensionAttributeDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Documentation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "text",
            type: "String",
            isBody: true
          },
          {
            name: "textFormat",
            "default": "text/plain",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Event",
        isAbstract: true,
        superClass: [
          "FlowNode",
          "InteractionNode"
        ],
        properties: [
          {
            name: "properties",
            type: "Property",
            isMany: true
          }
        ]
      },
      {
        name: "IntermediateCatchEvent",
        superClass: [
          "CatchEvent"
        ]
      },
      {
        name: "IntermediateThrowEvent",
        superClass: [
          "ThrowEvent"
        ]
      },
      {
        name: "EndEvent",
        superClass: [
          "ThrowEvent"
        ]
      },
      {
        name: "StartEvent",
        superClass: [
          "CatchEvent"
        ],
        properties: [
          {
            name: "isInterrupting",
            "default": true,
            isAttr: true,
            type: "Boolean"
          }
        ]
      },
      {
        name: "ThrowEvent",
        isAbstract: true,
        superClass: [
          "Event"
        ],
        properties: [
          {
            name: "dataInputs",
            type: "DataInput",
            isMany: true
          },
          {
            name: "dataInputAssociations",
            type: "DataInputAssociation",
            isMany: true
          },
          {
            name: "inputSet",
            type: "InputSet"
          },
          {
            name: "eventDefinitions",
            type: "EventDefinition",
            isMany: true
          },
          {
            name: "eventDefinitionRef",
            type: "EventDefinition",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "CatchEvent",
        isAbstract: true,
        superClass: [
          "Event"
        ],
        properties: [
          {
            name: "parallelMultiple",
            isAttr: true,
            type: "Boolean",
            "default": false
          },
          {
            name: "dataOutputs",
            type: "DataOutput",
            isMany: true
          },
          {
            name: "dataOutputAssociations",
            type: "DataOutputAssociation",
            isMany: true
          },
          {
            name: "outputSet",
            type: "OutputSet"
          },
          {
            name: "eventDefinitions",
            type: "EventDefinition",
            isMany: true
          },
          {
            name: "eventDefinitionRef",
            type: "EventDefinition",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "BoundaryEvent",
        superClass: [
          "CatchEvent"
        ],
        properties: [
          {
            name: "cancelActivity",
            "default": true,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "attachedToRef",
            type: "Activity",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "EventDefinition",
        isAbstract: true,
        superClass: [
          "RootElement"
        ]
      },
      {
        name: "CancelEventDefinition",
        superClass: [
          "EventDefinition"
        ]
      },
      {
        name: "ErrorEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "errorRef",
            type: "Error",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "TerminateEventDefinition",
        superClass: [
          "EventDefinition"
        ]
      },
      {
        name: "EscalationEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "escalationRef",
            type: "Escalation",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Escalation",
        properties: [
          {
            name: "structureRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "escalationCode",
            isAttr: true,
            type: "String"
          }
        ],
        superClass: [
          "RootElement"
        ]
      },
      {
        name: "CompensateEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "waitForCompletion",
            isAttr: true,
            type: "Boolean",
            "default": true
          },
          {
            name: "activityRef",
            type: "Activity",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "TimerEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "timeDate",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "timeCycle",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "timeDuration",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          }
        ]
      },
      {
        name: "LinkEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "target",
            type: "LinkEventDefinition",
            isReference: true
          },
          {
            name: "source",
            type: "LinkEventDefinition",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "MessageEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "messageRef",
            type: "Message",
            isAttr: true,
            isReference: true
          },
          {
            name: "operationRef",
            type: "Operation",
            isReference: true
          }
        ]
      },
      {
        name: "ConditionalEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "condition",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          }
        ]
      },
      {
        name: "SignalEventDefinition",
        superClass: [
          "EventDefinition"
        ],
        properties: [
          {
            name: "signalRef",
            type: "Signal",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Signal",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "structureRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ImplicitThrowEvent",
        superClass: [
          "ThrowEvent"
        ]
      },
      {
        name: "DataState",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ItemAwareElement",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "itemSubjectRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          },
          {
            name: "dataState",
            type: "DataState"
          }
        ]
      },
      {
        name: "DataAssociation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "sourceRef",
            type: "ItemAwareElement",
            isMany: true,
            isReference: true
          },
          {
            name: "targetRef",
            type: "ItemAwareElement",
            isReference: true
          },
          {
            name: "transformation",
            type: "FormalExpression",
            xml: {
              serialize: "property"
            }
          },
          {
            name: "assignment",
            type: "Assignment",
            isMany: true
          }
        ]
      },
      {
        name: "DataInput",
        superClass: [
          "ItemAwareElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "isCollection",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "inputSetRef",
            type: "InputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "inputSetWithOptional",
            type: "InputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "inputSetWithWhileExecuting",
            type: "InputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          }
        ]
      },
      {
        name: "DataOutput",
        superClass: [
          "ItemAwareElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "isCollection",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "outputSetRef",
            type: "OutputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "outputSetWithOptional",
            type: "OutputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "outputSetWithWhileExecuting",
            type: "OutputSet",
            isMany: true,
            isVirtual: true,
            isReference: true
          }
        ]
      },
      {
        name: "InputSet",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "dataInputRefs",
            type: "DataInput",
            isMany: true,
            isReference: true
          },
          {
            name: "optionalInputRefs",
            type: "DataInput",
            isMany: true,
            isReference: true
          },
          {
            name: "whileExecutingInputRefs",
            type: "DataInput",
            isMany: true,
            isReference: true
          },
          {
            name: "outputSetRefs",
            type: "OutputSet",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "OutputSet",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "dataOutputRefs",
            type: "DataOutput",
            isMany: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "inputSetRefs",
            type: "InputSet",
            isMany: true,
            isReference: true
          },
          {
            name: "optionalOutputRefs",
            type: "DataOutput",
            isMany: true,
            isReference: true
          },
          {
            name: "whileExecutingOutputRefs",
            type: "DataOutput",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "Property",
        superClass: [
          "ItemAwareElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "DataInputAssociation",
        superClass: [
          "DataAssociation"
        ]
      },
      {
        name: "DataOutputAssociation",
        superClass: [
          "DataAssociation"
        ]
      },
      {
        name: "InputOutputSpecification",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "dataInputs",
            type: "DataInput",
            isMany: true
          },
          {
            name: "dataOutputs",
            type: "DataOutput",
            isMany: true
          },
          {
            name: "inputSets",
            type: "InputSet",
            isMany: true
          },
          {
            name: "outputSets",
            type: "OutputSet",
            isMany: true
          }
        ]
      },
      {
        name: "DataObject",
        superClass: [
          "FlowElement",
          "ItemAwareElement"
        ],
        properties: [
          {
            name: "isCollection",
            "default": false,
            isAttr: true,
            type: "Boolean"
          }
        ]
      },
      {
        name: "InputOutputBinding",
        properties: [
          {
            name: "inputDataRef",
            type: "InputSet",
            isAttr: true,
            isReference: true
          },
          {
            name: "outputDataRef",
            type: "OutputSet",
            isAttr: true,
            isReference: true
          },
          {
            name: "operationRef",
            type: "Operation",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Assignment",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "from",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "to",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          }
        ]
      },
      {
        name: "DataStore",
        superClass: [
          "RootElement",
          "ItemAwareElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "capacity",
            isAttr: true,
            type: "Integer"
          },
          {
            name: "isUnlimited",
            "default": true,
            isAttr: true,
            type: "Boolean"
          }
        ]
      },
      {
        name: "DataStoreReference",
        superClass: [
          "ItemAwareElement",
          "FlowElement"
        ],
        properties: [
          {
            name: "dataStoreRef",
            type: "DataStore",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "DataObjectReference",
        superClass: [
          "ItemAwareElement",
          "FlowElement"
        ],
        properties: [
          {
            name: "dataObjectRef",
            type: "DataObject",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ConversationLink",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "sourceRef",
            type: "InteractionNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "targetRef",
            type: "InteractionNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ConversationAssociation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "innerConversationNodeRef",
            type: "ConversationNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "outerConversationNodeRef",
            type: "ConversationNode",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "CallConversation",
        superClass: [
          "ConversationNode"
        ],
        properties: [
          {
            name: "calledCollaborationRef",
            type: "Collaboration",
            isAttr: true,
            isReference: true
          },
          {
            name: "participantAssociations",
            type: "ParticipantAssociation",
            isMany: true
          }
        ]
      },
      {
        name: "Conversation",
        superClass: [
          "ConversationNode"
        ]
      },
      {
        name: "SubConversation",
        superClass: [
          "ConversationNode"
        ],
        properties: [
          {
            name: "conversationNodes",
            type: "ConversationNode",
            isMany: true
          }
        ]
      },
      {
        name: "ConversationNode",
        isAbstract: true,
        superClass: [
          "InteractionNode",
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "participantRef",
            type: "Participant",
            isMany: true,
            isReference: true
          },
          {
            name: "messageFlowRefs",
            type: "MessageFlow",
            isMany: true,
            isReference: true
          },
          {
            name: "correlationKeys",
            type: "CorrelationKey",
            isMany: true
          }
        ]
      },
      {
        name: "GlobalConversation",
        superClass: [
          "Collaboration"
        ]
      },
      {
        name: "PartnerEntity",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "participantRef",
            type: "Participant",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "PartnerRole",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "participantRef",
            type: "Participant",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "CorrelationProperty",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "correlationPropertyRetrievalExpression",
            type: "CorrelationPropertyRetrievalExpression",
            isMany: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "type",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Error",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "structureRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "errorCode",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "CorrelationKey",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "correlationPropertyRef",
            type: "CorrelationProperty",
            isMany: true,
            isReference: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Expression",
        superClass: [
          "BaseElement"
        ],
        isAbstract: false,
        properties: [
          {
            name: "body",
            isBody: true,
            type: "String"
          }
        ]
      },
      {
        name: "FormalExpression",
        superClass: [
          "Expression"
        ],
        properties: [
          {
            name: "language",
            isAttr: true,
            type: "String"
          },
          {
            name: "evaluatesToTypeRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Message",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "itemRef",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ItemDefinition",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "itemKind",
            type: "ItemKind",
            isAttr: true
          },
          {
            name: "structureRef",
            isAttr: true,
            type: "String"
          },
          {
            name: "isCollection",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "import",
            type: "Import",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "FlowElement",
        isAbstract: true,
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "auditing",
            type: "Auditing"
          },
          {
            name: "monitoring",
            type: "Monitoring"
          },
          {
            name: "categoryValueRef",
            type: "CategoryValue",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "SequenceFlow",
        superClass: [
          "FlowElement"
        ],
        properties: [
          {
            name: "isImmediate",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "conditionExpression",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "sourceRef",
            type: "FlowNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "targetRef",
            type: "FlowNode",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "FlowElementsContainer",
        isAbstract: true,
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "laneSets",
            type: "LaneSet",
            isMany: true
          },
          {
            name: "flowElements",
            type: "FlowElement",
            isMany: true
          }
        ]
      },
      {
        name: "CallableElement",
        isAbstract: true,
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "ioSpecification",
            type: "InputOutputSpecification",
            xml: {
              serialize: "property"
            }
          },
          {
            name: "supportedInterfaceRef",
            type: "Interface",
            isMany: true,
            isReference: true
          },
          {
            name: "ioBinding",
            type: "InputOutputBinding",
            isMany: true,
            xml: {
              serialize: "property"
            }
          }
        ]
      },
      {
        name: "FlowNode",
        isAbstract: true,
        superClass: [
          "FlowElement"
        ],
        properties: [
          {
            name: "incoming",
            type: "SequenceFlow",
            isMany: true,
            isReference: true
          },
          {
            name: "outgoing",
            type: "SequenceFlow",
            isMany: true,
            isReference: true
          },
          {
            name: "lanes",
            type: "Lane",
            isMany: true,
            isVirtual: true,
            isReference: true
          }
        ]
      },
      {
        name: "CorrelationPropertyRetrievalExpression",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "messagePath",
            type: "FormalExpression"
          },
          {
            name: "messageRef",
            type: "Message",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "CorrelationPropertyBinding",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "dataPath",
            type: "FormalExpression"
          },
          {
            name: "correlationPropertyRef",
            type: "CorrelationProperty",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Resource",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "resourceParameters",
            type: "ResourceParameter",
            isMany: true
          }
        ]
      },
      {
        name: "ResourceParameter",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "isRequired",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "type",
            type: "ItemDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "CorrelationSubscription",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "correlationKeyRef",
            type: "CorrelationKey",
            isAttr: true,
            isReference: true
          },
          {
            name: "correlationPropertyBinding",
            type: "CorrelationPropertyBinding",
            isMany: true
          }
        ]
      },
      {
        name: "MessageFlow",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "sourceRef",
            type: "InteractionNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "targetRef",
            type: "InteractionNode",
            isAttr: true,
            isReference: true
          },
          {
            name: "messageRef",
            type: "Message",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "MessageFlowAssociation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "innerMessageFlowRef",
            type: "MessageFlow",
            isAttr: true,
            isReference: true
          },
          {
            name: "outerMessageFlowRef",
            type: "MessageFlow",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "InteractionNode",
        isAbstract: true,
        properties: [
          {
            name: "incomingConversationLinks",
            type: "ConversationLink",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "outgoingConversationLinks",
            type: "ConversationLink",
            isMany: true,
            isVirtual: true,
            isReference: true
          }
        ]
      },
      {
        name: "Participant",
        superClass: [
          "InteractionNode",
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "interfaceRef",
            type: "Interface",
            isMany: true,
            isReference: true
          },
          {
            name: "participantMultiplicity",
            type: "ParticipantMultiplicity"
          },
          {
            name: "endPointRefs",
            type: "EndPoint",
            isMany: true,
            isReference: true
          },
          {
            name: "processRef",
            type: "Process",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ParticipantAssociation",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "innerParticipantRef",
            type: "Participant",
            isAttr: true,
            isReference: true
          },
          {
            name: "outerParticipantRef",
            type: "Participant",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ParticipantMultiplicity",
        properties: [
          {
            name: "minimum",
            "default": 0,
            isAttr: true,
            type: "Integer"
          },
          {
            name: "maximum",
            "default": 1,
            isAttr: true,
            type: "Integer"
          }
        ],
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "Collaboration",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "isClosed",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "participants",
            type: "Participant",
            isMany: true
          },
          {
            name: "messageFlows",
            type: "MessageFlow",
            isMany: true
          },
          {
            name: "artifacts",
            type: "Artifact",
            isMany: true
          },
          {
            name: "conversations",
            type: "ConversationNode",
            isMany: true
          },
          {
            name: "conversationAssociations",
            type: "ConversationAssociation"
          },
          {
            name: "participantAssociations",
            type: "ParticipantAssociation",
            isMany: true
          },
          {
            name: "messageFlowAssociations",
            type: "MessageFlowAssociation",
            isMany: true
          },
          {
            name: "correlationKeys",
            type: "CorrelationKey",
            isMany: true
          },
          {
            name: "choreographyRef",
            type: "Choreography",
            isMany: true,
            isReference: true
          },
          {
            name: "conversationLinks",
            type: "ConversationLink",
            isMany: true
          }
        ]
      },
      {
        name: "ChoreographyActivity",
        isAbstract: true,
        superClass: [
          "FlowNode"
        ],
        properties: [
          {
            name: "participantRef",
            type: "Participant",
            isMany: true,
            isReference: true
          },
          {
            name: "initiatingParticipantRef",
            type: "Participant",
            isAttr: true,
            isReference: true
          },
          {
            name: "correlationKeys",
            type: "CorrelationKey",
            isMany: true
          },
          {
            name: "loopType",
            type: "ChoreographyLoopType",
            "default": "None",
            isAttr: true
          }
        ]
      },
      {
        name: "CallChoreography",
        superClass: [
          "ChoreographyActivity"
        ],
        properties: [
          {
            name: "calledChoreographyRef",
            type: "Choreography",
            isAttr: true,
            isReference: true
          },
          {
            name: "participantAssociations",
            type: "ParticipantAssociation",
            isMany: true
          }
        ]
      },
      {
        name: "SubChoreography",
        superClass: [
          "ChoreographyActivity",
          "FlowElementsContainer"
        ],
        properties: [
          {
            name: "artifacts",
            type: "Artifact",
            isMany: true
          }
        ]
      },
      {
        name: "ChoreographyTask",
        superClass: [
          "ChoreographyActivity"
        ],
        properties: [
          {
            name: "messageFlowRef",
            type: "MessageFlow",
            isMany: true,
            isReference: true
          }
        ]
      },
      {
        name: "Choreography",
        superClass: [
          "Collaboration",
          "FlowElementsContainer"
        ]
      },
      {
        name: "GlobalChoreographyTask",
        superClass: [
          "Choreography"
        ],
        properties: [
          {
            name: "initiatingParticipantRef",
            type: "Participant",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "TextAnnotation",
        superClass: [
          "Artifact"
        ],
        properties: [
          {
            name: "text",
            type: "String"
          },
          {
            name: "textFormat",
            "default": "text/plain",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Group",
        superClass: [
          "Artifact"
        ],
        properties: [
          {
            name: "categoryValueRef",
            type: "CategoryValue",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Association",
        superClass: [
          "Artifact"
        ],
        properties: [
          {
            name: "associationDirection",
            type: "AssociationDirection",
            isAttr: true
          },
          {
            name: "sourceRef",
            type: "BaseElement",
            isAttr: true,
            isReference: true
          },
          {
            name: "targetRef",
            type: "BaseElement",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "Category",
        superClass: [
          "RootElement"
        ],
        properties: [
          {
            name: "categoryValue",
            type: "CategoryValue",
            isMany: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Artifact",
        isAbstract: true,
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "CategoryValue",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "categorizedFlowElements",
            type: "FlowElement",
            isMany: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "value",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Activity",
        isAbstract: true,
        superClass: [
          "FlowNode"
        ],
        properties: [
          {
            name: "isForCompensation",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "default",
            type: "SequenceFlow",
            isAttr: true,
            isReference: true
          },
          {
            name: "ioSpecification",
            type: "InputOutputSpecification",
            xml: {
              serialize: "property"
            }
          },
          {
            name: "boundaryEventRefs",
            type: "BoundaryEvent",
            isMany: true,
            isReference: true
          },
          {
            name: "properties",
            type: "Property",
            isMany: true
          },
          {
            name: "dataInputAssociations",
            type: "DataInputAssociation",
            isMany: true
          },
          {
            name: "dataOutputAssociations",
            type: "DataOutputAssociation",
            isMany: true
          },
          {
            name: "startQuantity",
            "default": 1,
            isAttr: true,
            type: "Integer"
          },
          {
            name: "resources",
            type: "ResourceRole",
            isMany: true
          },
          {
            name: "completionQuantity",
            "default": 1,
            isAttr: true,
            type: "Integer"
          },
          {
            name: "loopCharacteristics",
            type: "LoopCharacteristics"
          }
        ]
      },
      {
        name: "ServiceTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          },
          {
            name: "operationRef",
            type: "Operation",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "SubProcess",
        superClass: [
          "Activity",
          "FlowElementsContainer",
          "InteractionNode"
        ],
        properties: [
          {
            name: "triggeredByEvent",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "artifacts",
            type: "Artifact",
            isMany: true
          }
        ]
      },
      {
        name: "LoopCharacteristics",
        isAbstract: true,
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "MultiInstanceLoopCharacteristics",
        superClass: [
          "LoopCharacteristics"
        ],
        properties: [
          {
            name: "isSequential",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "behavior",
            type: "MultiInstanceBehavior",
            "default": "All",
            isAttr: true
          },
          {
            name: "loopCardinality",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "loopDataInputRef",
            type: "ItemAwareElement",
            isReference: true
          },
          {
            name: "loopDataOutputRef",
            type: "ItemAwareElement",
            isReference: true
          },
          {
            name: "inputDataItem",
            type: "DataInput",
            xml: {
              serialize: "property"
            }
          },
          {
            name: "outputDataItem",
            type: "DataOutput",
            xml: {
              serialize: "property"
            }
          },
          {
            name: "complexBehaviorDefinition",
            type: "ComplexBehaviorDefinition",
            isMany: true
          },
          {
            name: "completionCondition",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "oneBehaviorEventRef",
            type: "EventDefinition",
            isAttr: true,
            isReference: true
          },
          {
            name: "noneBehaviorEventRef",
            type: "EventDefinition",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "StandardLoopCharacteristics",
        superClass: [
          "LoopCharacteristics"
        ],
        properties: [
          {
            name: "testBefore",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "loopCondition",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "loopMaximum",
            type: "Integer",
            isAttr: true
          }
        ]
      },
      {
        name: "CallActivity",
        superClass: [
          "Activity",
          "InteractionNode"
        ],
        properties: [
          {
            name: "calledElement",
            type: "String",
            isAttr: true
          }
        ]
      },
      {
        name: "Task",
        superClass: [
          "Activity",
          "InteractionNode"
        ]
      },
      {
        name: "SendTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          },
          {
            name: "operationRef",
            type: "Operation",
            isAttr: true,
            isReference: true
          },
          {
            name: "messageRef",
            type: "Message",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ReceiveTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          },
          {
            name: "instantiate",
            "default": false,
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "operationRef",
            type: "Operation",
            isAttr: true,
            isReference: true
          },
          {
            name: "messageRef",
            type: "Message",
            isAttr: true,
            isReference: true
          }
        ]
      },
      {
        name: "ScriptTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "scriptFormat",
            isAttr: true,
            type: "String"
          },
          {
            name: "script",
            type: "String"
          }
        ]
      },
      {
        name: "BusinessRuleTask",
        superClass: [
          "Task"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "AdHocSubProcess",
        superClass: [
          "SubProcess"
        ],
        properties: [
          {
            name: "completionCondition",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "ordering",
            type: "AdHocOrdering",
            isAttr: true
          },
          {
            name: "cancelRemainingInstances",
            "default": true,
            isAttr: true,
            type: "Boolean"
          }
        ]
      },
      {
        name: "Transaction",
        superClass: [
          "SubProcess"
        ],
        properties: [
          {
            name: "protocol",
            isAttr: true,
            type: "String"
          },
          {
            name: "method",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "GlobalScriptTask",
        superClass: [
          "GlobalTask"
        ],
        properties: [
          {
            name: "scriptLanguage",
            isAttr: true,
            type: "String"
          },
          {
            name: "script",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "GlobalBusinessRuleTask",
        superClass: [
          "GlobalTask"
        ],
        properties: [
          {
            name: "implementation",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ComplexBehaviorDefinition",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "condition",
            type: "FormalExpression"
          },
          {
            name: "event",
            type: "ImplicitThrowEvent"
          }
        ]
      },
      {
        name: "ResourceRole",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "resourceRef",
            type: "Resource",
            isReference: true
          },
          {
            name: "resourceParameterBindings",
            type: "ResourceParameterBinding",
            isMany: true
          },
          {
            name: "resourceAssignmentExpression",
            type: "ResourceAssignmentExpression"
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ResourceParameterBinding",
        properties: [
          {
            name: "expression",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          },
          {
            name: "parameterRef",
            type: "ResourceParameter",
            isAttr: true,
            isReference: true
          }
        ],
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "ResourceAssignmentExpression",
        properties: [
          {
            name: "expression",
            type: "Expression",
            xml: {
              serialize: "xsi:type"
            }
          }
        ],
        superClass: [
          "BaseElement"
        ]
      },
      {
        name: "Import",
        properties: [
          {
            name: "importType",
            isAttr: true,
            type: "String"
          },
          {
            name: "location",
            isAttr: true,
            type: "String"
          },
          {
            name: "namespace",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "Definitions",
        superClass: [
          "BaseElement"
        ],
        properties: [
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "targetNamespace",
            isAttr: true,
            type: "String"
          },
          {
            name: "expressionLanguage",
            "default": "http://www.w3.org/1999/XPath",
            isAttr: true,
            type: "String"
          },
          {
            name: "typeLanguage",
            "default": "http://www.w3.org/2001/XMLSchema",
            isAttr: true,
            type: "String"
          },
          {
            name: "imports",
            type: "Import",
            isMany: true
          },
          {
            name: "extensions",
            type: "Extension",
            isMany: true
          },
          {
            name: "rootElements",
            type: "RootElement",
            isMany: true
          },
          {
            name: "diagrams",
            isMany: true,
            type: "bpmndi:BPMNDiagram"
          },
          {
            name: "exporter",
            isAttr: true,
            type: "String"
          },
          {
            name: "relationships",
            type: "Relationship",
            isMany: true
          },
          {
            name: "exporterVersion",
            isAttr: true,
            type: "String"
          }
        ]
      }
    ];
    enumerations$3 = [
      {
        name: "ProcessType",
        literalValues: [
          {
            name: "None"
          },
          {
            name: "Public"
          },
          {
            name: "Private"
          }
        ]
      },
      {
        name: "GatewayDirection",
        literalValues: [
          {
            name: "Unspecified"
          },
          {
            name: "Converging"
          },
          {
            name: "Diverging"
          },
          {
            name: "Mixed"
          }
        ]
      },
      {
        name: "EventBasedGatewayType",
        literalValues: [
          {
            name: "Parallel"
          },
          {
            name: "Exclusive"
          }
        ]
      },
      {
        name: "RelationshipDirection",
        literalValues: [
          {
            name: "None"
          },
          {
            name: "Forward"
          },
          {
            name: "Backward"
          },
          {
            name: "Both"
          }
        ]
      },
      {
        name: "ItemKind",
        literalValues: [
          {
            name: "Physical"
          },
          {
            name: "Information"
          }
        ]
      },
      {
        name: "ChoreographyLoopType",
        literalValues: [
          {
            name: "None"
          },
          {
            name: "Standard"
          },
          {
            name: "MultiInstanceSequential"
          },
          {
            name: "MultiInstanceParallel"
          }
        ]
      },
      {
        name: "AssociationDirection",
        literalValues: [
          {
            name: "None"
          },
          {
            name: "One"
          },
          {
            name: "Both"
          }
        ]
      },
      {
        name: "MultiInstanceBehavior",
        literalValues: [
          {
            name: "None"
          },
          {
            name: "One"
          },
          {
            name: "All"
          },
          {
            name: "Complex"
          }
        ]
      },
      {
        name: "AdHocOrdering",
        literalValues: [
          {
            name: "Parallel"
          },
          {
            name: "Sequential"
          }
        ]
      }
    ];
    xml$1 = {
      tagAlias: "lowerCase",
      typePrefix: "t"
    };
    BpmnPackage = {
      name: name$5,
      uri: uri$5,
      prefix: prefix$5,
      associations: associations$5,
      types: types$5,
      enumerations: enumerations$3,
      xml: xml$1
    };
    name$4 = "BPMNDI";
    uri$4 = "http://www.omg.org/spec/BPMN/20100524/DI";
    prefix$4 = "bpmndi";
    types$4 = [
      {
        name: "BPMNDiagram",
        properties: [
          {
            name: "plane",
            type: "BPMNPlane",
            redefines: "di:Diagram#rootElement"
          },
          {
            name: "labelStyle",
            type: "BPMNLabelStyle",
            isMany: true
          }
        ],
        superClass: [
          "di:Diagram"
        ]
      },
      {
        name: "BPMNPlane",
        properties: [
          {
            name: "bpmnElement",
            isAttr: true,
            isReference: true,
            type: "bpmn:BaseElement",
            redefines: "di:DiagramElement#modelElement"
          }
        ],
        superClass: [
          "di:Plane"
        ]
      },
      {
        name: "BPMNShape",
        properties: [
          {
            name: "bpmnElement",
            isAttr: true,
            isReference: true,
            type: "bpmn:BaseElement",
            redefines: "di:DiagramElement#modelElement"
          },
          {
            name: "isHorizontal",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "isExpanded",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "isMarkerVisible",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "label",
            type: "BPMNLabel"
          },
          {
            name: "isMessageVisible",
            isAttr: true,
            type: "Boolean"
          },
          {
            name: "participantBandKind",
            type: "ParticipantBandKind",
            isAttr: true
          },
          {
            name: "choreographyActivityShape",
            type: "BPMNShape",
            isAttr: true,
            isReference: true
          }
        ],
        superClass: [
          "di:LabeledShape"
        ]
      },
      {
        name: "BPMNEdge",
        properties: [
          {
            name: "label",
            type: "BPMNLabel"
          },
          {
            name: "bpmnElement",
            isAttr: true,
            isReference: true,
            type: "bpmn:BaseElement",
            redefines: "di:DiagramElement#modelElement"
          },
          {
            name: "sourceElement",
            isAttr: true,
            isReference: true,
            type: "di:DiagramElement",
            redefines: "di:Edge#source"
          },
          {
            name: "targetElement",
            isAttr: true,
            isReference: true,
            type: "di:DiagramElement",
            redefines: "di:Edge#target"
          },
          {
            name: "messageVisibleKind",
            type: "MessageVisibleKind",
            isAttr: true,
            "default": "initiating"
          }
        ],
        superClass: [
          "di:LabeledEdge"
        ]
      },
      {
        name: "BPMNLabel",
        properties: [
          {
            name: "labelStyle",
            type: "BPMNLabelStyle",
            isAttr: true,
            isReference: true,
            redefines: "di:DiagramElement#style"
          }
        ],
        superClass: [
          "di:Label"
        ]
      },
      {
        name: "BPMNLabelStyle",
        properties: [
          {
            name: "font",
            type: "dc:Font"
          }
        ],
        superClass: [
          "di:Style"
        ]
      }
    ];
    enumerations$2 = [
      {
        name: "ParticipantBandKind",
        literalValues: [
          {
            name: "top_initiating"
          },
          {
            name: "middle_initiating"
          },
          {
            name: "bottom_initiating"
          },
          {
            name: "top_non_initiating"
          },
          {
            name: "middle_non_initiating"
          },
          {
            name: "bottom_non_initiating"
          }
        ]
      },
      {
        name: "MessageVisibleKind",
        literalValues: [
          {
            name: "initiating"
          },
          {
            name: "non_initiating"
          }
        ]
      }
    ];
    associations$4 = [];
    BpmnDiPackage = {
      name: name$4,
      uri: uri$4,
      prefix: prefix$4,
      types: types$4,
      enumerations: enumerations$2,
      associations: associations$4
    };
    name$3 = "DC";
    uri$3 = "http://www.omg.org/spec/DD/20100524/DC";
    prefix$3 = "dc";
    types$3 = [
      {
        name: "Boolean"
      },
      {
        name: "Integer"
      },
      {
        name: "Real"
      },
      {
        name: "String"
      },
      {
        name: "Font",
        properties: [
          {
            name: "name",
            type: "String",
            isAttr: true
          },
          {
            name: "size",
            type: "Real",
            isAttr: true
          },
          {
            name: "isBold",
            type: "Boolean",
            isAttr: true
          },
          {
            name: "isItalic",
            type: "Boolean",
            isAttr: true
          },
          {
            name: "isUnderline",
            type: "Boolean",
            isAttr: true
          },
          {
            name: "isStrikeThrough",
            type: "Boolean",
            isAttr: true
          }
        ]
      },
      {
        name: "Point",
        properties: [
          {
            name: "x",
            type: "Real",
            "default": "0",
            isAttr: true
          },
          {
            name: "y",
            type: "Real",
            "default": "0",
            isAttr: true
          }
        ]
      },
      {
        name: "Bounds",
        properties: [
          {
            name: "x",
            type: "Real",
            "default": "0",
            isAttr: true
          },
          {
            name: "y",
            type: "Real",
            "default": "0",
            isAttr: true
          },
          {
            name: "width",
            type: "Real",
            isAttr: true
          },
          {
            name: "height",
            type: "Real",
            isAttr: true
          }
        ]
      }
    ];
    associations$3 = [];
    DcPackage = {
      name: name$3,
      uri: uri$3,
      prefix: prefix$3,
      types: types$3,
      associations: associations$3
    };
    name$2 = "DI";
    uri$2 = "http://www.omg.org/spec/DD/20100524/DI";
    prefix$2 = "di";
    types$2 = [
      {
        name: "DiagramElement",
        isAbstract: true,
        properties: [
          {
            name: "id",
            isAttr: true,
            isId: true,
            type: "String"
          },
          {
            name: "extension",
            type: "Extension"
          },
          {
            name: "owningDiagram",
            type: "Diagram",
            isReadOnly: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "owningElement",
            type: "DiagramElement",
            isReadOnly: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "modelElement",
            isReadOnly: true,
            isVirtual: true,
            isReference: true,
            type: "Element"
          },
          {
            name: "style",
            type: "Style",
            isReadOnly: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "ownedElement",
            type: "DiagramElement",
            isReadOnly: true,
            isMany: true,
            isVirtual: true
          }
        ]
      },
      {
        name: "Node",
        isAbstract: true,
        superClass: [
          "DiagramElement"
        ]
      },
      {
        name: "Edge",
        isAbstract: true,
        superClass: [
          "DiagramElement"
        ],
        properties: [
          {
            name: "source",
            type: "DiagramElement",
            isReadOnly: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "target",
            type: "DiagramElement",
            isReadOnly: true,
            isVirtual: true,
            isReference: true
          },
          {
            name: "waypoint",
            isUnique: false,
            isMany: true,
            type: "dc:Point",
            xml: {
              serialize: "xsi:type"
            }
          }
        ]
      },
      {
        name: "Diagram",
        isAbstract: true,
        properties: [
          {
            name: "id",
            isAttr: true,
            isId: true,
            type: "String"
          },
          {
            name: "rootElement",
            type: "DiagramElement",
            isReadOnly: true,
            isVirtual: true
          },
          {
            name: "name",
            isAttr: true,
            type: "String"
          },
          {
            name: "documentation",
            isAttr: true,
            type: "String"
          },
          {
            name: "resolution",
            isAttr: true,
            type: "Real"
          },
          {
            name: "ownedStyle",
            type: "Style",
            isReadOnly: true,
            isMany: true,
            isVirtual: true
          }
        ]
      },
      {
        name: "Shape",
        isAbstract: true,
        superClass: [
          "Node"
        ],
        properties: [
          {
            name: "bounds",
            type: "dc:Bounds"
          }
        ]
      },
      {
        name: "Plane",
        isAbstract: true,
        superClass: [
          "Node"
        ],
        properties: [
          {
            name: "planeElement",
            type: "DiagramElement",
            subsettedProperty: "DiagramElement-ownedElement",
            isMany: true
          }
        ]
      },
      {
        name: "LabeledEdge",
        isAbstract: true,
        superClass: [
          "Edge"
        ],
        properties: [
          {
            name: "ownedLabel",
            type: "Label",
            isReadOnly: true,
            subsettedProperty: "DiagramElement-ownedElement",
            isMany: true,
            isVirtual: true
          }
        ]
      },
      {
        name: "LabeledShape",
        isAbstract: true,
        superClass: [
          "Shape"
        ],
        properties: [
          {
            name: "ownedLabel",
            type: "Label",
            isReadOnly: true,
            subsettedProperty: "DiagramElement-ownedElement",
            isMany: true,
            isVirtual: true
          }
        ]
      },
      {
        name: "Label",
        isAbstract: true,
        superClass: [
          "Node"
        ],
        properties: [
          {
            name: "bounds",
            type: "dc:Bounds"
          }
        ]
      },
      {
        name: "Style",
        isAbstract: true,
        properties: [
          {
            name: "id",
            isAttr: true,
            isId: true,
            type: "String"
          }
        ]
      },
      {
        name: "Extension",
        properties: [
          {
            name: "values",
            isMany: true,
            type: "Element"
          }
        ]
      }
    ];
    associations$2 = [];
    xml = {
      tagAlias: "lowerCase"
    };
    DiPackage = {
      name: name$2,
      uri: uri$2,
      prefix: prefix$2,
      types: types$2,
      associations: associations$2,
      xml
    };
    name$1 = "bpmn.io colors for BPMN";
    uri$1 = "http://bpmn.io/schema/bpmn/biocolor/1.0";
    prefix$1 = "bioc";
    types$1 = [
      {
        name: "ColoredShape",
        "extends": [
          "bpmndi:BPMNShape"
        ],
        properties: [
          {
            name: "stroke",
            isAttr: true,
            type: "String"
          },
          {
            name: "fill",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ColoredEdge",
        "extends": [
          "bpmndi:BPMNEdge"
        ],
        properties: [
          {
            name: "stroke",
            isAttr: true,
            type: "String"
          },
          {
            name: "fill",
            isAttr: true,
            type: "String"
          }
        ]
      }
    ];
    enumerations$1 = [];
    associations$1 = [];
    BiocPackage = {
      name: name$1,
      uri: uri$1,
      prefix: prefix$1,
      types: types$1,
      enumerations: enumerations$1,
      associations: associations$1
    };
    name = "BPMN in Color";
    uri = "http://www.omg.org/spec/BPMN/non-normative/color/1.0";
    prefix = "color";
    types = [
      {
        name: "ColoredLabel",
        "extends": [
          "bpmndi:BPMNLabel"
        ],
        properties: [
          {
            name: "color",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ColoredShape",
        "extends": [
          "bpmndi:BPMNShape"
        ],
        properties: [
          {
            name: "background-color",
            isAttr: true,
            type: "String"
          },
          {
            name: "border-color",
            isAttr: true,
            type: "String"
          }
        ]
      },
      {
        name: "ColoredEdge",
        "extends": [
          "bpmndi:BPMNEdge"
        ],
        properties: [
          {
            name: "border-color",
            isAttr: true,
            type: "String"
          }
        ]
      }
    ];
    enumerations = [];
    associations = [];
    BpmnInColorPackage = {
      name,
      uri,
      prefix,
      types,
      enumerations,
      associations
    };
    packages = {
      bpmn: BpmnPackage,
      bpmndi: BpmnDiPackage,
      dc: DcPackage,
      di: DiPackage,
      bioc: BiocPackage,
      color: BpmnInColorPackage
    };
  }
});

// node_modules/bpmn-auto-layout/dist/index.js
var dist_exports = {};
__export(dist_exports, {
  LayoutError: () => LayoutError,
  LayoutWarning: () => LayoutWarning,
  layoutProcess: () => layoutProcess
});
function getDefaultSize(element) {
  if (is(element, "bpmn:Activity")) {
    return { width: DEFAULT_TASK_WIDTH, height: DEFAULT_TASK_HEIGHT };
  }
  if (is(element, "bpmn:Gateway")) {
    return { width: 50, height: 50 };
  }
  if (is(element, "bpmn:Event")) {
    return { width: 36, height: 36 };
  }
  if (is(element, "bpmn:Participant")) {
    return { width: 300, height: 60 };
  }
  if (is(element, "bpmn:Lane")) {
    return { width: 300, height: 60 };
  }
  if (is(element, "bpmn:DataObjectReference")) {
    return { width: 36, height: 50 };
  }
  if (is(element, "bpmn:DataStoreReference")) {
    return { width: 50, height: 50 };
  }
  if (is(element, "bpmn:TextAnnotation")) {
    return { width: 100, height: 40 };
  }
  return null;
}
function is(element, type) {
  return !!element && element.$instanceOf(type);
}
function isArtifact(element) {
  return is(element, "bpmn:TextAnnotation") || is(element, "bpmn:DataObjectReference") || is(element, "bpmn:DataStoreReference") || is(element, "bpmn:Group");
}
function isExteriorArtifact(element) {
  return is(element, "bpmn:TextAnnotation") || is(element, "bpmn:DataStoreReference");
}
function isExternalLabelOwner(element) {
  return is(element, "bpmn:Event") || is(element, "bpmn:Gateway") || is(element, "bpmn:DataStoreReference") || is(element, "bpmn:DataObjectReference") || is(element, "bpmn:SequenceFlow") || is(element, "bpmn:MessageFlow") || is(element, "bpmn:Group");
}
function getExternalLabelText(element) {
  if (is(element, "bpmn:Group")) {
    return element.categoryValueRef?.value || "";
  }
  return element.name || "";
}
function hasSubProcessLabel(element) {
  return is(element, "bpmn:SubProcess") && !!element.name?.trim();
}
function hasEventDefinition(event, type) {
  return (event.eventDefinitions || []).some((definition) => is(definition, type));
}
function isSupportedVisualElement(element) {
  return is(element, "bpmn:Activity") || is(element, "bpmn:Event") || is(element, "bpmn:Gateway") && !is(element, "bpmn:ComplexGateway") || isArtifact(element) || is(element, "bpmn:Participant") || is(element, "bpmn:Lane");
}
function isSupportedVisualConnection(element) {
  return is(element, "bpmn:SequenceFlow") || is(element, "bpmn:MessageFlow") || is(element, "bpmn:Association") || is(element, "bpmn:DataAssociation");
}
function getExpandedIds(definitions, root) {
  const diagram = (definitions.diagrams || []).find((candidate) => candidate.plane?.bpmnElement === root);
  const ids = /* @__PURE__ */ new Set();
  for (const element of diagram?.plane?.planeElement || []) {
    if (element.$instanceOf("bpmndi:BPMNShape") && element.isExpanded === true) {
      ids.add(element.bpmnElement.id);
    }
  }
  return ids;
}
function createLayout(scope) {
  return {
    scope,
    shapes: /* @__PURE__ */ new Map(),
    edges: /* @__PURE__ */ new Map(),
    children: [],
    emitInParent: false
  };
}
function bounds(x, y, width, height) {
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
function point(x, y) {
  return { x: Math.round(x), y: Math.round(y) };
}
function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function integerBounds(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}
function normalizeLayout(layout) {
  const extents = getShapeExtents([
    ...layout.shapes.entries(),
    ...getExpandedChildShapes(layout)
  ].map(([element, rect]) => ({ element, rect })));
  translateLayout(layout, OUTER_MARGIN - extents.minX, OUTER_MARGIN - extents.minY);
}
function translateLayout(layout, dx, dy) {
  for (const rect of layout.shapes.values()) {
    rect.x += dx;
    rect.y += dy;
  }
  for (const points of layout.edges.values()) {
    for (const routePoint of points) {
      routePoint.x += dx;
      routePoint.y += dy;
    }
  }
  for (const child of layout.children) {
    if (child.emitInParent) {
      translateLayout(child, dx, dy);
    }
  }
}
function getExtents(layout) {
  return getShapeExtents([...layout.shapes.entries()].map(([element, rect]) => ({ element, rect })));
}
function getParticipantContentExtents(layout) {
  return getShapeExtents([...layout.shapes.entries()].filter(([element]) => !isExteriorArtifact(element)).map(([element, rect]) => ({ element, rect })));
}
function hasParticipantContent(layout) {
  return [...layout.shapes.keys()].some((element) => !isExteriorArtifact(element));
}
function getShapeExtents(shapes) {
  if (!shapes.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...shapes.map(({ rect }) => rect.x));
  const minY = Math.min(...shapes.map(({ rect }) => rect.y));
  const maxX = Math.max(...shapes.map(({ rect }) => rect.x + rect.width));
  const maxY = Math.max(...shapes.map(({ rect }) => rect.y + rect.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
function getRecordExtents(records) {
  return getShapeExtents(records.map((record) => ({ rect: record.bounds })));
}
function getExpandedChildShapes(layout) {
  const shapes = [];
  for (const child of layout.children) {
    if (!child.emitInParent) {
      continue;
    }
    shapes.push(...child.shapes.entries());
    shapes.push(...getExpandedChildShapes(child));
  }
  return shapes;
}
function getExpandedChildEdges(layout) {
  const edges = [];
  for (const child of layout.children) {
    if (!child.emitInParent) {
      continue;
    }
    edges.push(...child.edges.entries());
    edges.push(...getExpandedChildEdges(child));
  }
  return edges;
}
function directConnection(source, target) {
  const sourceCenter = point(source.x + source.width / 2, source.y + source.height / 2);
  const targetCenter = point(target.x + target.width / 2, target.y + target.height / 2);
  return [sourceCenter, targetCenter];
}
function compareScores(a, b) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}
function routeLength(points) {
  return toSegments(points).reduce((total, [start, end]) => {
    return total + manhattan(start, end);
  }, 0);
}
function cleanPoints(points) {
  const cleaned = [];
  for (const candidate of points) {
    const previous = cleaned.at(-1);
    if (!previous || previous.x !== candidate.x || previous.y !== candidate.y) {
      cleaned.push(candidate);
    }
    while (cleaned.length >= 3) {
      const next = cleaned.at(-1);
      const middle = cleaned.at(-2);
      const before = cleaned.at(-3);
      const collinear = (before.x - middle.x) * (next.y - middle.y) === (before.y - middle.y) * (next.x - middle.x);
      if (!collinear) {
        break;
      }
      cleaned.splice(-2, 1);
      if (before.x === next.x && before.y === next.y) {
        cleaned.pop();
      }
    }
  }
  return cleaned.map((candidate) => point(candidate.x, candidate.y));
}
function toSegments(points) {
  return points.slice(1).map((end, index) => [points[index], end]);
}
function pointInRect(candidate, rect) {
  return candidate.x > rect.x && candidate.x < rect.x + rect.width && candidate.y > rect.y && candidate.y < rect.y + rect.height;
}
function inset(rect, margin) {
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: rect.width - 2 * margin,
    height: rect.height - 2 * margin
  };
}
function segmentEntersRect(a, b, rect) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edgeDirections = [-dx, dx, -dy, dy];
  const edgeDistances = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  let start = 0;
  let end = 1;
  for (let index = 0; index < edgeDirections.length; index++) {
    if (edgeDirections[index] === 0) {
      if (edgeDistances[index] < 0) {
        return false;
      }
      continue;
    }
    const ratio = edgeDistances[index] / edgeDirections[index];
    if (edgeDirections[index] < 0) {
      if (ratio > end) {
        return false;
      }
      start = Math.max(start, ratio);
    } else {
      if (ratio < start) {
        return false;
      }
      end = Math.min(end, ratio);
    }
  }
  return end - start > SEGMENT_INTERSECTION_EPSILON;
}
function collinearOverlap(a, b, c, d) {
  const horizontal = a.y === b.y && c.y === d.y && a.y === c.y;
  const vertical = a.x === b.x && c.x === d.x && a.x === c.x;
  if (!horizontal && !vertical) {
    return false;
  }
  const [aStart, aEnd, cStart, cEnd] = horizontal ? [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(c.x, d.x), Math.max(c.x, d.x)] : [Math.min(a.y, b.y), Math.max(a.y, b.y), Math.min(c.y, d.y), Math.max(c.y, d.y)];
  return Math.min(aEnd, cEnd) - Math.max(aStart, cStart) > 0;
}
function segmentsProperlyCross(a, b, c, d) {
  const abC = segmentDirection(a, b, c);
  const abD = segmentDirection(a, b, d);
  const cdA = segmentDirection(c, d, a);
  const cdB = segmentDirection(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}
function segmentDirection(a, b, c) {
  return Math.sign(
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  );
}
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function validateSequenceFlows(flows, recordsByElement, scope) {
  for (const flow of flows) {
    const source = flow.sourceRef;
    const target = flow.targetRef;
    if (source && target && (source.$parent !== scope || target.$parent !== scope)) {
      throw new LayoutError(
        "CROSS_SCOPE_SEQUENCE_FLOW",
        flow.id,
        "A sequence flow cannot cross a containment scope.",
        [source.id, target.id]
      );
    }
    if (!source || !target || !recordsByElement.has(source) || !recordsByElement.has(target)) {
      throw new LayoutError(
        "INVALID_SEQUENCE_FLOW_ENDPOINT",
        flow.id,
        "A sequence flow must reference source and target flow nodes in its scope."
      );
    }
  }
}
function validateMessageFlows(flows) {
  for (const flow of flows) {
    if (!flow.sourceRef || !flow.targetRef) {
      throw new LayoutError(
        "INVALID_MESSAGE_FLOW_ENDPOINT",
        flow.id,
        "A message flow must reference source and target interaction nodes."
      );
    }
  }
}
function validateBoundaryEvents(records, recordsByElement, scope) {
  for (const record of records.filter((record2) => record2.isBoundary)) {
    const host = record.element.attachedToRef;
    if (!host || !recordsByElement.has(host) || host.$parent !== scope) {
      throw new LayoutError(
        "INVALID_BOUNDARY_HOST",
        record.element.id,
        "A boundary event must attach to an activity in the same scope.",
        host?.id ? [host.id] : []
      );
    }
  }
}
function validateLinks(records, scope) {
  const events = records.filter((record) => is(record.element, "bpmn:IntermediateThrowEvent") || is(record.element, "bpmn:IntermediateCatchEvent"));
  const links = /* @__PURE__ */ new Map();
  for (const record of events) {
    const definition = (record.element.eventDefinitions || []).find((candidate) => {
      return is(candidate, "bpmn:LinkEventDefinition");
    });
    if (!definition) {
      continue;
    }
    const name2 = definition.name || "";
    if (!links.has(name2)) {
      links.set(name2, []);
    }
    links.get(name2).push(record.element);
  }
  for (const [name2, elements] of links) {
    const throws = elements.filter((element) => is(element, "bpmn:IntermediateThrowEvent"));
    const catches = elements.filter((element) => is(element, "bpmn:IntermediateCatchEvent"));
    if (throws.length !== 1 || catches.length !== 1) {
      throw new LayoutError(
        "INVALID_LINK_EVENT_PAIR",
        elements[0].id,
        `Link event "${name2}" must have exactly one throw and one catch in scope "${scope.id}".`,
        elements.map((element) => element.id)
      );
    }
  }
}
function validateInputVisuals(definitions, root) {
  const diagram = (definitions.diagrams || []).find((candidate) => candidate.plane?.bpmnElement === root);
  for (const di of diagram?.plane?.planeElement || []) {
    if (!di.$instanceOf("bpmndi:BPMNShape")) {
      continue;
    }
    const element = di.bpmnElement;
    if (!element || is(element, "bpmn:Group") || getDefaultSize(element) && isSupportedVisualElement(element)) {
      continue;
    }
    throw new LayoutError(
      "UNSUPPORTED_ELEMENT",
      element.id,
      `Cannot generate DI for visual BPMN element "${element.$type}".`
    );
  }
}
function validateParseWarnings(warnings, xml3) {
  const invalidProcessRef = warnings.find((warning) => warning.property === "bpmn:processRef");
  if (invalidProcessRef) {
    throw new LayoutError(
      "INVALID_PARTICIPANT_PROCESS_REFERENCE",
      invalidProcessRef.element.id,
      "A participant processRef must reference a declared process."
    );
  }
  const unknownType = warnings.find((warning) => warning.message.includes("unknown type"));
  if (unknownType) {
    const elementId = /<bpmn:[^ >]+[^>]*\sid="([^"]+)"/.exec(xml3)?.[1] || "unknown";
    throw new LayoutError(
      "UNSUPPORTED_ELEMENT",
      elementId,
      "Cannot generate DI for an unknown BPMN visual element."
    );
  }
}
function createSemanticPolicy(scope, records, graphEdges, boundaryEdges, allRecords) {
  const edgeOrder = /* @__PURE__ */ new Map();
  const flowNodeDocumentIndex = new Map(records.map((record) => [record.element, record.index]));
  const allElementsDocumentIndex = new Map(allRecords.map((record) => [record.element, record.index]));
  const outgoing = new Map(records.map((record) => [record.element, []]));
  graphEdges.forEach((edge, edgeIndex) => {
    edgeOrder.set(edge, edgeIndex);
    outgoing.get(edge.sourceRef).push(edge);
  });
  boundaryEdges.forEach((edge, edgeIndex) => edgeOrder.set(edge, graphEdges.length + edgeIndex));
  const compactFlowRegions = is(scope, "bpmn:AdHocSubProcess") ? findCompactFlowRegions(records, graphEdges, outgoing, edgeOrder) : [];
  const rankWeights = createCompactRankWeights(compactFlowRegions);
  const cycleOutgoing = new Map(records.map((record) => [record.element, []]));
  for (const edge of graphEdges) {
    cycleOutgoing.get(edge.sourceRef).push(edge);
  }
  for (const edge of boundaryEdges) {
    cycleOutgoing.get(edge.sourceRef.attachedToRef).push(edge);
  }
  const backEdges = /* @__PURE__ */ new Set();
  const boundaryBayEdges = /* @__PURE__ */ new Set();
  markBackEdges(
    records.map((record) => record.element),
    cycleOutgoing,
    backEdges,
    flowNodeDocumentIndex
  );
  const selectEdge = (node, candidates, visited2) => {
    return selectPrimaryEdge(node, candidates, edgeOrder, visited2, outgoing);
  };
  const spine = /* @__PURE__ */ new Set();
  const starts = records.filter((record) => is(record.element, "bpmn:StartEvent")).sort((a, b) => a.index - b.index);
  const incomingNodes = new Set(graphEdges.map((edge) => edge.targetRef));
  const sourceNodes = records.filter((record) => !incomingNodes.has(record.element)).map((record) => record.element);
  const primarySeed = starts[0]?.element || sourceNodes[0] || records[0]?.element;
  const adHocSources = is(scope, "bpmn:AdHocSubProcess") ? sourceNodes : [];
  const seeds = [
    primarySeed,
    ...adHocSources,
    ...records.filter((record) => {
      return is(record.element, "bpmn:IntermediateCatchEvent") && (record.element.eventDefinitions || []).some((definition) => {
        return is(definition, "bpmn:LinkEventDefinition");
      });
    }).map((record) => record.element)
  ];
  const visited = /* @__PURE__ */ new Set();
  const claimed = /* @__PURE__ */ new Set();
  const components = /* @__PURE__ */ new Map();
  const adjacent = new Map(records.map((record) => [record.element, []]));
  let componentIndex = 0;
  for (const edge of graphEdges) {
    adjacent.get(edge.sourceRef).push(edge.targetRef);
    adjacent.get(edge.targetRef).push(edge.sourceRef);
  }
  for (const edge of boundaryEdges) {
    const host = edge.sourceRef.attachedToRef;
    adjacent.get(host).push(edge.targetRef);
    adjacent.get(edge.targetRef).push(host);
  }
  for (const seed of records.map((record) => record.element)) {
    if (claimed.has(seed)) {
      continue;
    }
    const componentQueue = [seed];
    claimed.add(seed);
    components.set(seed, componentIndex);
    while (componentQueue.length) {
      const element = componentQueue.shift();
      for (const neighbor of adjacent.get(element)) {
        if (!claimed.has(neighbor)) {
          claimed.add(neighbor);
          components.set(neighbor, componentIndex);
          componentQueue.push(neighbor);
        }
      }
    }
    componentIndex++;
  }
  const mainComponent = components.get(primarySeed);
  const componentSeeds = /* @__PURE__ */ new Map();
  for (const record of starts) {
    const component = components.get(record.element);
    if (!componentSeeds.has(component)) {
      componentSeeds.set(component, record.element);
    }
  }
  seeds.push(...componentSeeds.values());
  for (const seed of seeds) {
    if (!seed || visited.has(seed)) {
      continue;
    }
    if (!is(scope, "bpmn:AdHocSubProcess") && seed !== primarySeed && components.get(seed) === mainComponent) {
      continue;
    }
    let current = seed;
    while (current && !visited.has(current)) {
      visited.add(current);
      const candidates = outgoing.get(current) || [];
      const next = selectEdge(current, candidates, visited);
      if (!next) {
        break;
      }
      spine.add(next);
      current = next.targetRef;
    }
  }
  const straightEdges = new Set(spine);
  for (const record of records) {
    const candidates = outgoing.get(record.element) || [];
    if (is(record.element, "bpmn:Gateway") && candidates.length > 1) {
      straightEdges.add(selectEdge(record.element, candidates, /* @__PURE__ */ new Set()));
    }
  }
  const straightTargets = [...straightEdges].map((edge) => edge.targetRef);
  while (straightTargets.length) {
    const node = straightTargets.shift();
    const candidates = outgoing.get(node) || [];
    if (candidates.length !== 1 || straightEdges.has(candidates[0])) {
      continue;
    }
    straightEdges.add(candidates[0]);
    straightTargets.push(candidates[0].targetRef);
  }
  const bands = assignSemanticBands(
    records,
    graphEdges,
    boundaryEdges,
    straightEdges,
    flowNodeDocumentIndex,
    allElementsDocumentIndex,
    edgeOrder,
    components,
    backEdges
  );
  for (const edge of graphEdges) {
    const sourceIsJoin = is(edge.sourceRef, "bpmn:Gateway") && (edge.sourceRef.incoming || []).length > 1 && (edge.sourceRef.outgoing || []).length === 1;
    const targetIsJoin = is(edge.targetRef, "bpmn:Gateway") && (edge.targetRef.incoming || []).length > 1;
    if (sourceIsJoin && targetIsJoin && edge.sourceRef.$type === edge.targetRef.$type && bands.get(edge.sourceRef) !== bands.get(edge.targetRef)) {
      rankWeights.set(edge, 0);
    }
  }
  alignLinkEventContinuationBands(records, graphEdges, bands);
  return {
    spine,
    straightEdges,
    bands,
    components,
    edgeOrder,
    flowNodeDocumentIndex,
    graphEdges,
    compactFlowRegions,
    rankWeights,
    backEdges,
    boundaryBayEdges
  };
}
function findCompactFlowRegions(records, graphEdges, outgoing, edgeOrder) {
  const incomingCount = new Map(records.map((record) => [record.element, 0]));
  for (const edge of graphEdges) {
    incomingCount.set(edge.targetRef, incomingCount.get(edge.targetRef) + 1);
  }
  const regions = [];
  for (const record of records) {
    const split = record.element;
    const branches = outgoing.get(split) || [];
    if (branches.length < 2) {
      continue;
    }
    const distances = branches.map((branch) => {
      return descendantDistances(branch.targetRef, outgoing, split);
    });
    const common = [...distances[0].keys()].filter((node) => {
      return node !== split && incomingCount.get(node) > 1 && distances.every((distance) => distance.has(node));
    });
    if (!common.length) {
      continue;
    }
    const join = common.sort((a, b) => {
      const distancesA = distances.map((distance) => distance.get(a));
      const distancesB = distances.map((distance) => distance.get(b));
      return Math.max(...distancesA) - Math.max(...distancesB) || distancesA.reduce((sum, distance) => sum + distance, 0) - distancesB.reduce((sum, distance) => sum + distance, 0) || indexOfNode(a, records) - indexOfNode(b, records);
    })[0];
    const paths = branches.map((branch) => {
      return [
        branch,
        ...shortestFlowPath(branch.targetRef, join, outgoing, edgeOrder, split)
      ];
    });
    const primaryEdge = selectPrimaryEdge(split, branches, edgeOrder, /* @__PURE__ */ new Set(), outgoing);
    const primaryPath = paths.find((path) => path[0] === primaryEdge);
    regions.push({ split, join, paths, primaryPath });
  }
  return regions;
}
function descendantDistances(start, outgoing, blocked) {
  const distances = /* @__PURE__ */ new Map([[start, 0]]);
  const pending = [start];
  while (pending.length) {
    const node = pending.shift();
    for (const edge of outgoing.get(node) || []) {
      const target = edge.targetRef;
      if (target === blocked || distances.has(target)) {
        continue;
      }
      distances.set(target, distances.get(node) + 1);
      pending.push(target);
    }
  }
  return distances;
}
function shortestFlowPath(start, target, outgoing, edgeOrder, blocked) {
  if (start === target) {
    return [];
  }
  const pending = [start];
  const previous = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set([start, blocked]);
  while (pending.length) {
    const node = pending.shift();
    const edges = [...outgoing.get(node) || []].sort((a, b) => edgeOrder.get(a) - edgeOrder.get(b));
    for (const edge of edges) {
      if (visited.has(edge.targetRef)) {
        continue;
      }
      visited.add(edge.targetRef);
      previous.set(edge.targetRef, edge);
      if (edge.targetRef === target) {
        const path = [];
        for (let current = target; current !== start; ) {
          const previousEdge = previous.get(current);
          path.unshift(previousEdge);
          current = previousEdge.sourceRef;
        }
        return path;
      }
      pending.push(edge.targetRef);
    }
  }
  return [];
}
function indexOfNode(node, records) {
  return records.find((record) => record.element === node)?.index ?? Infinity;
}
function createCompactRankWeights(regions) {
  const weights = /* @__PURE__ */ new Map();
  for (const { paths, primaryPath } of regions) {
    const span = primaryPath.length;
    for (const path of paths) {
      if (path === primaryPath) {
        continue;
      }
      const internalCount = path.length - 1;
      const offsets = [0];
      for (let index = 1; index <= internalCount; index++) {
        const offset = internalCount === 1 ? Math.floor(span / 2) : Math.floor((index - 1) * span / (internalCount - 1));
        offsets.push(offset);
      }
      offsets.push(span);
      path.forEach((edge, index) => {
        const weight = offsets[index + 1] - offsets[index];
        const existing = weights.get(edge);
        weights.set(edge, existing === void 0 ? weight : Math.min(existing, weight));
      });
    }
  }
  return weights;
}
function alignLinkEventContinuationBands(records, graphEdges, bands) {
  const links = /* @__PURE__ */ new Map();
  const outgoing = new Map(records.map((record) => [record.element, []]));
  const incomingCount = new Map(records.map((record) => [record.element, 0]));
  for (const edge of graphEdges) {
    outgoing.get(edge.sourceRef).push(edge);
    incomingCount.set(edge.targetRef, incomingCount.get(edge.targetRef) + 1);
  }
  for (const record of records) {
    const definition = (record.element.eventDefinitions || []).find((candidate) => {
      return is(candidate, "bpmn:LinkEventDefinition");
    });
    if (!definition) {
      continue;
    }
    const name2 = definition.name || "";
    if (!links.has(name2)) {
      links.set(name2, {});
    }
    if (is(record.element, "bpmn:IntermediateThrowEvent")) {
      links.get(name2).throwEvent = record.element;
    } else if (is(record.element, "bpmn:IntermediateCatchEvent")) {
      links.get(name2).catchEvent = record.element;
    }
  }
  for (const { throwEvent, catchEvent } of links.values()) {
    if (!throwEvent || !catchEvent) {
      continue;
    }
    const offset = (bands.get(throwEvent) || 0) - (bands.get(catchEvent) || 0);
    const pending = [catchEvent];
    const visited = /* @__PURE__ */ new Set();
    while (pending.length) {
      const element = pending.shift();
      if (visited.has(element)) {
        continue;
      }
      visited.add(element);
      bands.set(element, (bands.get(element) || 0) + offset);
      for (const edge of outgoing.get(element) || []) {
        if (incomingCount.get(edge.targetRef) <= 1) {
          pending.push(edge.targetRef);
        }
      }
    }
  }
}
function assignBoundaryBandOffsets(boundaryEdges, flowNodeDocumentIndex) {
  const edgesByHost = /* @__PURE__ */ new Map();
  for (const edge of boundaryEdges) {
    const host = edge.sourceRef.attachedToRef;
    const side = hasEventDefinition(edge.sourceRef, "bpmn:EscalationEventDefinition") ? "top" : "bottom";
    if (!edgesByHost.has(host)) {
      edgesByHost.set(host, { top: /* @__PURE__ */ new Map(), bottom: /* @__PURE__ */ new Map() });
    }
    const edgesByEvent = edgesByHost.get(host)[side];
    if (!edgesByEvent.has(edge.sourceRef)) {
      edgesByEvent.set(edge.sourceRef, []);
    }
    edgesByEvent.get(edge.sourceRef).push(edge);
  }
  const assigned = /* @__PURE__ */ new Map();
  for (const [, sides] of edgesByHost) {
    for (const [side, edgesByEvent] of Object.entries(sides)) {
      let offset = 1;
      const direction = side === "top" ? -1 : 1;
      const eventGroups = [...edgesByEvent.entries()].sort(([eventA], [eventB]) => flowNodeDocumentIndex.get(eventB) - flowNodeDocumentIndex.get(eventA)).map(([, edges]) => edges);
      for (const edges of eventGroups) {
        for (const edge of edges) {
          assigned.set(edge, direction * offset);
          offset++;
        }
      }
    }
  }
  return assigned;
}
function assignSemanticBands(records, graphEdges, boundaryEdges, straightEdges, flowNodeDocumentIndex, allElementsDocumentIndex, edgeIndex, components, backEdges) {
  const nodes = records.map((record) => record.element);
  const outgoing = new Map(nodes.map((node) => [node, []]));
  const incomingCount = new Map(nodes.map((node) => [node, 0]));
  for (const edge of graphEdges) {
    outgoing.get(edge.sourceRef).push(edge);
  }
  for (const edge of graphEdges) {
    if (!backEdges.has(edge)) {
      incomingCount.set(edge.targetRef, incomingCount.get(edge.targetRef) + 1);
    }
  }
  const bands = new Map(nodes.map((node) => [node, 0]));
  const occupied = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const reserveBand = (component, base, offset) => {
    if (!occupied.has(component)) {
      occupied.set(component, /* @__PURE__ */ new Set([0]));
    }
    const used = occupied.get(component);
    const direction = Math.sign(offset);
    let candidate = base + offset;
    while (used.has(candidate)) {
      candidate += direction;
    }
    used.add(candidate);
    return candidate;
  };
  const visit = (node, band, component = components.get(node)) => {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    bands.set(node, band);
    if (!occupied.has(component)) {
      occupied.set(component, /* @__PURE__ */ new Set());
    }
    occupied.get(component).add(band);
    const candidates = (outgoing.get(node) || []).filter((edge) => !backEdges.has(edge)).sort((a, b) => edgeIndex.get(a) - edgeIndex.get(b));
    const primary = candidates.find((edge) => straightEdges.has(edge)) || candidates[0];
    if (primary) {
      visit(primary.targetRef, band, component);
    }
    let branchIndex = 0;
    for (const edge of candidates) {
      if (edge === primary) {
        continue;
      }
      const oneSided = Boolean(node.default);
      const outwardDirection = oneSided && band !== 0 ? Math.sign(band) : 1;
      const offset = branchOffset(branchIndex++, oneSided) * outwardDirection;
      visit(edge.targetRef, reserveBand(component, band, offset), component);
    }
  };
  const boundaryTargets = new Set(boundaryEdges.map((edge) => edge.targetRef));
  const sources = records.filter((record) => incomingCount.get(record.element) === 0 && !boundaryTargets.has(record.element)).sort((a, b) => a.index - b.index);
  for (const record of sources) {
    visit(record.element, 0);
  }
  const boundaryOffsets = assignBoundaryBandOffsets(boundaryEdges, allElementsDocumentIndex);
  for (const edge of [...boundaryEdges].sort((a, b) => edgeIndex.get(a) - edgeIndex.get(b))) {
    if (visited.has(edge.targetRef)) {
      continue;
    }
    const host = edge.sourceRef.attachedToRef;
    const component = components.get(host);
    const hostBand = bands.get(host) || 0;
    visit(
      edge.targetRef,
      reserveBand(component, hostBand, boundaryOffsets.get(edge)),
      component
    );
  }
  for (const record of [...records].sort((a, b) => a.index - b.index)) {
    visit(record.element, 0);
  }
  return bands;
}
function selectPrimaryEdge(node, edges, edgeOrder, visited = /* @__PURE__ */ new Set(), outgoing = /* @__PURE__ */ new Map()) {
  if (!edges.length) {
    return null;
  }
  const defaultEdge = node.default;
  const forwardEdges = edges.filter((edge) => !visited.has(edge.targetRef));
  const candidates = forwardEdges.length ? forwardEdges : edges;
  const endReaching = candidates.filter((edge) => {
    return canReachEndEvent(edge.targetRef, outgoing, /* @__PURE__ */ new Set([node]));
  });
  const preferred = endReaching.length ? endReaching : candidates;
  return preferred.find((edge) => edge === defaultEdge) || [...preferred].sort((a, b) => edgeOrder.get(a) - edgeOrder.get(b))[0];
}
function canReachEndEvent(node, outgoing, path) {
  if (is(node, "bpmn:EndEvent")) {
    return true;
  }
  if (path.has(node)) {
    return false;
  }
  path.add(node);
  for (const edge of outgoing.get(node) || []) {
    if (canReachEndEvent(edge.targetRef, outgoing, path)) {
      path.delete(node);
      return true;
    }
  }
  path.delete(node);
  return false;
}
function branchOffset(index, oneSided = false) {
  if (oneSided) {
    return index + 1;
  }
  const distance = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? distance : -distance;
}
function assignRanks(records, graphEdges, boundaryEdges, policy) {
  const rank = new Map(records.map((record) => [record.element, 0]));
  const outgoing = new Map(records.map((record) => [record.element, []]));
  const indegree = new Map(records.map((record) => [record.element, 0]));
  const backEdges = policy.backEdges;
  for (const edge of graphEdges) {
    outgoing.get(edge.sourceRef).push(edge);
  }
  for (const edge of graphEdges) {
    if (!backEdges.has(edge)) {
      indegree.set(edge.targetRef, indegree.get(edge.targetRef) + 1);
    }
  }
  const ready = records.filter((record) => indegree.get(record.element) === 0).sort((a, b) => a.index - b.index);
  const processed = /* @__PURE__ */ new Set();
  while (ready.length) {
    const record = ready.shift();
    const source = record.element;
    if (processed.has(source)) {
      continue;
    }
    processed.add(source);
    for (const edge of outgoing.get(source)) {
      if (backEdges.has(edge)) {
        continue;
      }
      const weight = policy.rankWeights.get(edge) ?? 1;
      rank.set(
        edge.targetRef,
        Math.max(rank.get(edge.targetRef), rank.get(source) + weight)
      );
      indegree.set(edge.targetRef, indegree.get(edge.targetRef) - 1);
      if (indegree.get(edge.targetRef) === 0) {
        ready.push(records.find((candidate) => candidate.element === edge.targetRef));
        ready.sort((a, b) => a.index - b.index);
      }
    }
  }
  for (const record of records) {
    if (!processed.has(record.element)) {
      rank.set(record.element, 0);
    }
  }
  reserveGatewayBranchSpans(rank, outgoing, policy.spine, backEdges);
  stabilizeRanks(rank, graphEdges, boundaryEdges, policy, records.length);
  for (let iteration = 0; !policy.compactFlowRegions.length && iteration < policy.spine.size; iteration++) {
    const changed = reserveDetachedBranchSpans(
      rank,
      outgoing,
      boundaryEdges,
      policy.spine,
      backEdges,
      records,
      policy
    );
    if (!changed) {
      break;
    }
    stabilizeRanks(rank, graphEdges, boundaryEdges, policy, records.length);
  }
  return { rank, backEdges };
}
function reserveGatewayBranchSpans(rank, outgoing, spine, backEdges) {
  const spineNodes = /* @__PURE__ */ new Set();
  for (const edge of spine) {
    spineNodes.add(edge.sourceRef);
    spineNodes.add(edge.targetRef);
  }
  for (const spineEdge of spine) {
    if (!is(spineEdge.targetRef, "bpmn:Gateway")) {
      continue;
    }
    const branches = (outgoing.get(spineEdge.sourceRef) || []).filter((edge) => {
      return edge !== spineEdge && !backEdges.has(edge);
    });
    let reservedUntil = rank.get(spineEdge.targetRef);
    for (const branch of branches) {
      const branchEnd = findDetachedBranchEnd(
        branch,
        rank,
        outgoing,
        spineNodes,
        backEdges
      );
      if (branchEnd !== null) {
        reservedUntil = Math.max(reservedUntil, branchEnd + 1);
      }
    }
    rank.set(spineEdge.targetRef, reservedUntil);
  }
}
function stabilizeRanks(rank, graphEdges, boundaryEdges, policy, maxIterations) {
  const backEdges = policy.backEdges;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;
    for (const edge of graphEdges) {
      if (backEdges.has(edge)) {
        continue;
      }
      const candidate = rank.get(edge.sourceRef) + (policy.rankWeights.get(edge) ?? 1);
      if (candidate > rank.get(edge.targetRef)) {
        rank.set(edge.targetRef, candidate);
        changed = true;
      }
    }
    for (const edge of boundaryEdges) {
      if (backEdges.has(edge)) {
        continue;
      }
      const hostRank = rank.get(edge.sourceRef.attachedToRef);
      const candidate = hostRank + 1;
      if (candidate > rank.get(edge.targetRef)) {
        rank.set(edge.targetRef, candidate);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
}
function reserveDetachedBranchSpans(rank, outgoing, boundaryEdges, spine, backEdges, records, policy) {
  const spineNodes = /* @__PURE__ */ new Set();
  const boundaryBranches = /* @__PURE__ */ new Map();
  const laneByNode = getLaneMemberships(records);
  let changed = false;
  for (const edge of spine) {
    spineNodes.add(edge.sourceRef);
    spineNodes.add(edge.targetRef);
  }
  for (const edge of boundaryEdges) {
    const host = edge.sourceRef.attachedToRef;
    if (!boundaryBranches.has(host)) {
      boundaryBranches.set(host, []);
    }
    boundaryBranches.get(host).push(edge);
  }
  for (const spineEdge of spine) {
    const sourceBoundaryBranches = (boundaryBranches.get(spineEdge.sourceRef) || []).filter((edge) => !backEdges.has(edge));
    const continuationBranches = [
      ...outgoing.get(spineEdge.targetRef) || [],
      ...boundaryBranches.get(spineEdge.targetRef) || []
    ].filter((edge) => !backEdges.has(edge));
    const targetIsJoin = (spineEdge.targetRef.incoming || []).length > 1;
    const reserveBoundaryBay = sourceBoundaryBranches.length && targetIsJoin;
    const boundaryBayOnly = continuationBranches.length < 2;
    if (continuationBranches.length < 2 && !reserveBoundaryBay) {
      continue;
    }
    const branches = boundaryBayOnly ? sourceBoundaryBranches : [
      ...(outgoing.get(spineEdge.sourceRef) || []).filter((edge) => edge !== spineEdge),
      ...sourceBoundaryBranches
    ].filter((edge) => !backEdges.has(edge));
    const sourceRank = rank.get(spineEdge.sourceRef);
    let reservedUntil = rank.get(spineEdge.targetRef);
    for (const branch of branches) {
      const branchEnd = findDetachedBranchEnd(
        branch,
        rank,
        outgoing,
        spineNodes,
        backEdges,
        sourceRank,
        boundaryBayOnly ? laneByNode : null
      );
      if (branchEnd !== null) {
        if (boundaryBayOnly) {
          policy.boundaryBayEdges.add(branch);
        }
        reservedUntil = Math.max(reservedUntil, branchEnd + 1);
      }
    }
    if (reservedUntil > rank.get(spineEdge.targetRef)) {
      rank.set(spineEdge.targetRef, reservedUntil);
      changed = true;
    }
  }
  return changed;
}
function getLaneMemberships(records) {
  const laneByNode = /* @__PURE__ */ new Map();
  const scopes = new Set(records.map((record) => record.element.$parent).filter(Boolean));
  const visitLane = (lane) => {
    for (const node of lane.flowNodeRef || []) {
      laneByNode.set(node, lane);
    }
    for (const child of lane.childLaneSet?.lanes || []) {
      visitLane(child);
    }
  };
  for (const scope of scopes) {
    for (const laneSet of scope.laneSets || []) {
      for (const lane of laneSet.lanes || []) {
        visitLane(lane);
      }
    }
  }
  return laneByNode;
}
function findDetachedBranchEnd(branch, rank, outgoing, spineNodes, backEdges, sourceRank = null, laneByNode = null) {
  const pending = [{ node: branch.targetRef, distance: 1 }];
  const visited = /* @__PURE__ */ new Set();
  let detached = true;
  let cyclic = false;
  let lane;
  let laneInitialized = false;
  let branchEnd = sourceRank === null ? rank.get(branch.targetRef) : sourceRank + 1;
  while (pending.length) {
    const { node, distance } = pending.shift();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    branchEnd = Math.max(branchEnd, rank.get(node));
    if (laneByNode) {
      const nodeLane = laneByNode.get(node) || null;
      if (laneInitialized && nodeLane !== lane) {
        detached = false;
      } else {
        lane = nodeLane;
        laneInitialized = true;
      }
    }
    if (sourceRank !== null) {
      branchEnd = Math.max(branchEnd, sourceRank + distance);
    }
    if (spineNodes.has(node)) {
      detached = false;
      continue;
    }
    for (const edge of outgoing.get(node) || []) {
      if (backEdges.has(edge)) {
        cyclic = true;
      } else {
        pending.push({
          node: edge.targetRef,
          distance: distance + 1
        });
      }
    }
  }
  return detached && !cyclic ? branchEnd : null;
}
function markBackEdges(nodes, outgoing, backEdges, flowNodeDocumentIndex) {
  const state = /* @__PURE__ */ new Map();
  const incomingCount = new Map(nodes.map((node) => [node, 0]));
  for (const edges of outgoing.values()) {
    for (const edge of edges) {
      incomingCount.set(edge.targetRef, incomingCount.get(edge.targetRef) + 1);
    }
  }
  function visit(node) {
    state.set(node, "visiting");
    const edges = [...outgoing.get(node) || []].sort((a, b) => flowNodeDocumentIndex.get(a.targetRef) - flowNodeDocumentIndex.get(b.targetRef));
    for (const edge of edges) {
      const targetState = state.get(edge.targetRef);
      if (targetState === "visiting") {
        backEdges.add(edge);
      } else if (!targetState) {
        visit(edge.targetRef);
      }
    }
    state.set(node, "visited");
  }
  const ordered = [...nodes].sort((a, b) => {
    const sourceA = incomingCount.get(a) === 0;
    const sourceB = incomingCount.get(b) === 0;
    if (sourceA !== sourceB) {
      return sourceA ? -1 : 1;
    }
    const startA = is(a, "bpmn:StartEvent");
    const startB = is(b, "bpmn:StartEvent");
    if (startA !== startB) {
      return startA ? -1 : 1;
    }
    return flowNodeDocumentIndex.get(a) - flowNodeDocumentIndex.get(b);
  });
  for (const node of ordered) {
    if (!state.has(node)) {
      visit(node);
    }
  }
}
function edgePriority(edge, policy) {
  if (policy.spine?.has(edge)) {
    return EDGE_PRIORITY.SPINE;
  }
  if (policy.straightEdges?.has(edge)) {
    return EDGE_PRIORITY.STRAIGHT;
  }
  const sourceBand = policy.bands?.get(edge.sourceRef) || 0;
  const targetBand = policy.bands?.get(edge.targetRef) || 0;
  const crossBandGatewayBranch = is(edge.sourceRef, "bpmn:Gateway") && (edge.sourceRef.outgoing || []).length > 1 && sourceBand !== targetBand;
  if (!policy.backEdges?.has(edge) && crossBandGatewayBranch) {
    return EDGE_PRIORITY.CROSS_BAND_GATEWAY_BRANCH;
  }
  if (policy.backEdges?.has(edge)) {
    return EDGE_PRIORITY.BACK_EDGE;
  }
  return EDGE_PRIORITY.STANDARD;
}
function placeRecords(records, ranks, policy) {
  const byRank = /* @__PURE__ */ new Map();
  for (const record of records) {
    const rank = ranks.rank.get(record.element) || 0;
    record.rank = rank;
    if (!byRank.has(rank)) {
      byRank.set(rank, []);
    }
    byRank.get(rank).push(record);
  }
  const rankNumbers = [...byRank.keys()].sort((a, b) => a - b);
  const rankWidths = /* @__PURE__ */ new Map();
  let x = 0;
  for (const rank of rankNumbers) {
    const width = Math.max(...byRank.get(rank).map((record) => record.size.width));
    rankWidths.set(rank, width);
    for (const record of byRank.get(rank)) {
      record.bounds = bounds(
        x + Math.round((width - record.size.width) / 2),
        (policy.bands.get(record.element) || 0) * (VERTICAL_GAP + SEMANTIC_BAND_HEIGHT) - record.size.height / 2,
        record.size.width,
        record.size.height
      );
    }
    x += width + HORIZONTAL_GAP;
  }
  for (const rank of rankNumbers) {
    const occupied = /* @__PURE__ */ new Map();
    for (const record of byRank.get(rank).sort((a, b) => a.index - b.index)) {
      const band = policy.bands.get(record.element) || 0;
      const key = `${policy.components.get(record.element)}:${band}`;
      const offset = occupied.get(key) || 0;
      record.bounds.y += offset;
      occupied.set(key, offset + record.size.height + VERTICAL_GAP);
    }
  }
}
function clearBoundaryHandlerExits(records, boundaryEdges, recordsByElement, policy) {
  const ordered = [...boundaryEdges].sort((a, b) => {
    const bandA = policy.bands.get(a.targetRef) || 0;
    const bandB = policy.bands.get(b.targetRef) || 0;
    return Math.abs(bandA) - Math.abs(bandB);
  });
  for (const edge of ordered) {
    const boundary = recordsByElement.get(edge.sourceRef);
    const host = recordsByElement.get(edge.sourceRef.attachedToRef);
    const target = recordsByElement.get(edge.targetRef);
    const targetBand = policy.bands.get(edge.targetRef) || 0;
    const hostBand = policy.bands.get(edge.sourceRef.attachedToRef) || 0;
    const component = policy.components.get(edge.targetRef);
    if (targetBand === hostBand) {
      continue;
    }
    const exitsTop = hasEventDefinition(
      edge.sourceRef,
      "bpmn:EscalationEventDefinition"
    );
    const boundaryExitY = exitsTop ? host.bounds.y - boundary.size.height / 2 : host.bounds.y + host.bounds.height + boundary.size.height / 2;
    const targetCenterY = target.bounds.y + target.bounds.height / 2;
    const requiredCenterY = boundaryExitY + (exitsTop ? -ROUTING_MARGIN : ROUTING_MARGIN);
    const shift = exitsTop ? Math.min(0, requiredCenterY - targetCenterY) : Math.max(0, requiredCenterY - targetCenterY);
    if (!shift) {
      continue;
    }
    for (const record of records) {
      const band = policy.bands.get(record.element) || 0;
      const sameSideOrFurther = exitsTop ? band <= targetBand : band >= targetBand;
      if (policy.components.get(record.element) === component && sameSideOrFurther) {
        record.bounds.y += shift;
      }
    }
  }
}
function compactSemanticBands(records, graphEdges, boundaryEdges, ranks, policy) {
  const intervals = /* @__PURE__ */ new Map();
  const outgoingCount = new Map(records.map((record) => [record.element, 0]));
  const addInterval = (component, band, min, max, boundary = false) => {
    if (!band) {
      return;
    }
    const key = `${component}:${band}`;
    const existing = intervals.get(key);
    if (existing) {
      existing.spans.push({ min, max });
      existing.boundary ||= boundary;
    } else {
      intervals.set(key, {
        component,
        band,
        boundary,
        spans: [{ min, max }]
      });
    }
  };
  for (const edge of graphEdges) {
    outgoingCount.set(edge.sourceRef, outgoingCount.get(edge.sourceRef) + 1);
  }
  for (const record of records) {
    const element = record.element;
    const rank = ranks.rank.get(element);
    addInterval(
      policy.components.get(element),
      policy.bands.get(element) || 0,
      rank,
      rank
    );
  }
  for (const edge of graphEdges) {
    if (policy.backEdges.has(edge)) {
      continue;
    }
    const sourceRank = ranks.rank.get(edge.sourceRef);
    const targetRank = ranks.rank.get(edge.targetRef);
    const min = Math.min(sourceRank, targetRank);
    const max = Math.max(sourceRank, targetRank);
    const sourceBand = policy.bands.get(edge.sourceRef) || 0;
    const targetBand = policy.bands.get(edge.targetRef) || 0;
    const occupiedBand = sourceBand === targetBand ? sourceBand : outgoingCount.get(edge.sourceRef) > 1 ? targetBand : sourceBand;
    addInterval(
      policy.components.get(edge.sourceRef),
      occupiedBand,
      min,
      max
    );
  }
  for (const edge of boundaryEdges) {
    const host = edge.sourceRef.attachedToRef;
    const sourceRank = ranks.rank.get(host);
    const targetRank = ranks.rank.get(edge.targetRef);
    addInterval(
      policy.components.get(host),
      policy.bands.get(edge.targetRef) || 0,
      Math.min(sourceRank, targetRank),
      Math.max(sourceRank, targetRank),
      policy.boundaryBayEdges.has(edge)
    );
  }
  const assigned = /* @__PURE__ */ new Map();
  const mapping = /* @__PURE__ */ new Map();
  const boundaryHosts = /* @__PURE__ */ new Map();
  for (const edge of boundaryEdges) {
    const host = edge.sourceRef.attachedToRef;
    const component = policy.components.get(host);
    const targetBand = policy.bands.get(edge.targetRef) || 0;
    const key = `${component}:${targetBand}`;
    if (!boundaryHosts.has(key)) {
      boundaryHosts.set(key, []);
    }
    boundaryHosts.get(key).push(policy.bands.get(host) || 0);
  }
  const ordered = [...intervals.values()].sort((a, b) => {
    return a.component - b.component || Math.sign(a.band) - Math.sign(b.band) || Number(b.boundary) - Number(a.boundary) || Math.abs(a.band) - Math.abs(b.band);
  });
  for (const interval of ordered) {
    const direction = Math.sign(interval.band);
    const hostBands = boundaryHosts.get(`${interval.component}:${interval.band}`) || [];
    const minimumMagnitude = hostBands.reduce((minimum, hostBand) => {
      if (Math.sign(hostBand) !== direction) {
        return minimum;
      }
      const compactedHost = mapping.get(`${interval.component}:${hostBand}`) || hostBand;
      return Math.max(minimum, Math.abs(compactedHost) + 1);
    }, 1);
    let compacted = direction * minimumMagnitude;
    let placed = false;
    while (!placed) {
      const key = `${interval.component}:${compacted}`;
      const occupied = assigned.get(key) || [];
      const overlaps = occupied.some((existing) => {
        return interval.spans.some((span) => {
          return existing.spans.some((other) => {
            return span.min <= other.max && span.max >= other.min;
          });
        });
      });
      if (!overlaps) {
        occupied.push(interval);
        assigned.set(key, occupied);
        mapping.set(`${interval.component}:${interval.band}`, compacted);
        placed = true;
        continue;
      }
      compacted += direction;
    }
  }
  for (const record of records) {
    const element = record.element;
    const band = policy.bands.get(element) || 0;
    if (band) {
      policy.bands.set(
        element,
        mapping.get(`${policy.components.get(element)}:${band}`)
      );
    }
  }
}
function packComponents(scope, records, graphEdges, boundaryEdges) {
  const parent = new Map(records.map((record) => [record.element, record.element]));
  const find2 = (element) => {
    const root = parent.get(element);
    if (root === element) {
      return root;
    }
    const compressed = find2(root);
    parent.set(element, compressed);
    return compressed;
  };
  const union = (a, b) => {
    const rootA = find2(a);
    const rootB = find2(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  };
  for (const edge of [...graphEdges, ...boundaryEdges]) {
    const source = is(edge.sourceRef, "bpmn:BoundaryEvent") ? edge.sourceRef.attachedToRef : edge.sourceRef;
    if (parent.has(source) && parent.has(edge.targetRef)) {
      union(source, edge.targetRef);
    }
  }
  const components = /* @__PURE__ */ new Map();
  for (const record of records) {
    const root = find2(record.element);
    if (!components.has(root)) {
      components.set(root, []);
    }
    components.get(root).push(record);
  }
  const ordered = [...components.values()].sort((a, b) => {
    return Math.min(...a.map((record) => record.index)) - Math.min(...b.map((record) => record.index));
  });
  for (const component of ordered) {
    separateRankOverlaps(component);
  }
  if (is(scope, "bpmn:AdHocSubProcess")) {
    packCompactComponents(ordered);
    return;
  }
  let y = 0;
  for (const component of ordered) {
    const extents = getRecordExtents(component);
    const dx = -extents.minX;
    const dy = y - extents.minY;
    for (const record of component) {
      record.bounds.x += dx;
      record.bounds.y += dy;
    }
    y += extents.height + 2 * VERTICAL_GAP;
  }
}
function packCompactComponents(components) {
  const items = components.map((component) => {
    const extents = getRecordExtents(component);
    return {
      component,
      extents,
      index: Math.min(...component.map((record) => record.index)),
      width: extents.width,
      height: extents.height
    };
  }).sort((a, b) => {
    return b.height - a.height || b.width - a.width || a.index - b.index;
  });
  const totalArea = items.reduce((sum, item) => {
    return sum + (item.width + HORIZONTAL_GAP) * (item.height + VERTICAL_GAP);
  }, 0);
  const packingWidth = Math.max(
    ...items.map((item) => item.width),
    Math.ceil(Math.sqrt(totalArea))
  );
  const placed = [];
  for (const item of items) {
    const xs = [0, ...placed.map((candidate) => candidate.x + candidate.width + HORIZONTAL_GAP)];
    const ys = [0, ...placed.map((candidate) => candidate.y + candidate.height + VERTICAL_GAP)];
    let placement = null;
    for (const y of [...new Set(ys)].sort((a, b) => a - b)) {
      for (const x of [...new Set(xs)].sort((a, b) => a - b)) {
        const candidate = bounds(x, y, item.width, item.height);
        if (x + item.width > packingWidth) {
          continue;
        }
        if (placed.some((other) => rectanglesOverlapWithGap(candidate, other))) {
          continue;
        }
        placement = candidate;
        break;
      }
      if (placement) {
        break;
      }
    }
    if (!placement) {
      const y = placed.length ? Math.max(...placed.map((candidate) => candidate.y + candidate.height)) + VERTICAL_GAP : 0;
      placement = bounds(0, y, item.width, item.height);
    }
    const dx = placement.x - item.extents.minX;
    const dy = placement.y - item.extents.minY;
    for (const record of item.component) {
      record.bounds.x += dx;
      record.bounds.y += dy;
    }
    placed.push(placement);
  }
}
function rectanglesOverlapWithGap(a, b) {
  return a.x < b.x + b.width + HORIZONTAL_GAP && a.x + a.width + HORIZONTAL_GAP > b.x && a.y < b.y + b.height + VERTICAL_GAP && a.y + a.height + VERTICAL_GAP > b.y;
}
function separateRankOverlaps(records) {
  const byRank = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (!byRank.has(record.rank)) {
      byRank.set(record.rank, []);
    }
    byRank.get(record.rank).push(record);
  }
  for (const rankRecords of byRank.values()) {
    const placed = [];
    for (const record of rankRecords.sort((a, b) => a.index - b.index)) {
      let blockers;
      while ((blockers = placed.filter((other) => rectanglesOverlap(record.bounds, other.bounds))).length) {
        record.bounds.y = Math.max(
          record.bounds.y,
          ...blockers.map((other) => other.bounds.y + other.bounds.height + VERTICAL_GAP)
        );
      }
      placed.push(record);
    }
  }
}
function applyLaneMembership(scope, records, graphEdges, policy, layout) {
  const lanes = flattenLanes(scope.laneSets || []);
  if (!lanes.length) {
    return;
  }
  const memberships = /* @__PURE__ */ new Map();
  for (const lane of lanes) {
    for (const node of lane.flowNodeRef || []) {
      if (!memberships.has(node)) {
        memberships.set(node, []);
      }
      memberships.get(node).push(lane);
    }
  }
  for (const [node, nodeLanes] of memberships) {
    const deepest = nodeLanes.filter((lane) => {
      return !nodeLanes.some((other) => other !== lane && laneContains(lane, other));
    });
    if (deepest.length !== 1) {
      throw new LayoutError(
        "INVALID_LANE_MEMBERSHIP",
        node.id,
        "A flow node must have one deepest lane membership.",
        deepest.map((lane) => lane.id)
      );
    }
    memberships.set(node, deepest);
  }
  const maxRight = Math.max(...records.map((record) => record.bounds.x + record.bounds.width), MIN_LANE_CONTENT_WIDTH);
  for (const record of records) {
    record.bounds.x += LANE_CONTENT_PADDING;
  }
  const laneHeights = /* @__PURE__ */ new Map();
  const rowsByLane = /* @__PURE__ */ new Map();
  const recordByElement = new Map(records.map((record) => [record.element, record]));
  const rowParents = new Map(records.map((record) => [record, record]));
  const rowMembers = new Map(records.map((record) => [record, [record]]));
  const findRow = (record) => {
    let root = record;
    while (rowParents.get(root) !== root) {
      root = rowParents.get(root);
    }
    while (rowParents.get(record) !== record) {
      const parent = rowParents.get(record);
      rowParents.set(record, root);
      record = parent;
    }
    return root;
  };
  const mergeRows = (a, b) => {
    const rootA = findRow(a);
    const rootB = findRow(b);
    if (rootA === rootB) {
      return;
    }
    const membersA = rowMembers.get(rootA);
    const membersB = rowMembers.get(rootB);
    const collides = membersA.some((recordA) => {
      return membersB.some((recordB) => {
        return recordA.bounds.x < recordB.bounds.x + recordB.bounds.width && recordA.bounds.x + recordA.bounds.width > recordB.bounds.x;
      });
    });
    if (collides) {
      return;
    }
    rowParents.set(rootB, rootA);
    rowMembers.set(rootA, [...membersA, ...membersB]);
    rowMembers.delete(rootB);
  };
  for (const lane of lanes) {
    const recordsByCenter = /* @__PURE__ */ new Map();
    for (const record of records.filter((record2) => memberships.get(record2.element)?.[0] === lane)) {
      const centerY = record.bounds.y + record.bounds.height / 2;
      const existing = recordsByCenter.get(centerY);
      if (existing) {
        mergeRows(existing, record);
      } else {
        recordsByCenter.set(centerY, record);
      }
    }
  }
  for (const edge of graphEdges) {
    const source = recordByElement.get(edge.sourceRef);
    const target = recordByElement.get(edge.targetRef);
    const sourceLane = memberships.get(edge.sourceRef)?.[0];
    const targetLane = memberships.get(edge.targetRef)?.[0];
    const linearContinuation = (edge.sourceRef.outgoing || []).filter((flow) => is(flow, "bpmn:SequenceFlow")).length === 1 && (edge.targetRef.incoming || []).filter((flow) => is(flow, "bpmn:SequenceFlow")).length === 1;
    if (source && target && sourceLane && sourceLane === targetLane && !policy.backEdges.has(edge) && (policy.straightEdges.has(edge) || linearContinuation)) {
      mergeRows(source, target);
    }
  }
  const getLaneRows = (lane) => {
    if (rowsByLane.has(lane)) {
      return rowsByLane.get(lane);
    }
    const rows = /* @__PURE__ */ new Map();
    const directRecords = records.filter((record) => memberships.get(record.element)?.[0] === lane);
    for (const record of directRecords) {
      const root = findRow(record);
      if (!rows.has(root)) {
        rows.set(root, []);
      }
      rows.get(root).push(record);
    }
    const ordered = [...rows.values()].sort((rowA, rowB) => {
      const centerA = Math.min(...rowA.map((record) => record.bounds.y + record.bounds.height / 2));
      const centerB = Math.min(...rowB.map((record) => record.bounds.y + record.bounds.height / 2));
      return centerA - centerB;
    });
    rowsByLane.set(lane, ordered);
    return ordered;
  };
  const requiredLaneHeight = (lane) => {
    if (laneHeights.has(lane)) {
      return laneHeights.get(lane);
    }
    const rows = getLaneRows(lane);
    const directHeight = rows.length ? rows.reduce((total, row) => {
      return total + Math.max(...row.map((record) => record.bounds.height));
    }, 0) + Math.max(0, rows.length - 1) * VERTICAL_GAP + 2 * VERTICAL_GAP : 0;
    const childrenHeight = (lane.childLaneSet?.lanes || []).reduce((total, child) => {
      return total + requiredLaneHeight(child);
    }, 0);
    const height = Math.max(MIN_LANE_HEIGHT, directHeight, childrenHeight);
    laneHeights.set(lane, height);
    return height;
  };
  let y = 0;
  for (const lane of lanes.filter((lane2) => !lanes.some((other) => other !== lane2 && laneContains(other, lane2)))) {
    const height = requiredLaneHeight(lane);
    addLaneLayout(lane, y, height, maxRight + 2 * LANE_CONTENT_PADDING, layout, laneHeights);
    y += height;
  }
  for (const lane of lanes) {
    const laneBounds = layout.shapes.get(lane);
    const rows = getLaneRows(lane);
    if (!laneBounds || !rows.length) {
      continue;
    }
    const totalHeight = rows.reduce((total, row) => {
      return total + Math.max(...row.map((record) => record.bounds.height));
    }, 0) + Math.max(0, rows.length - 1) * VERTICAL_GAP;
    let recordY = laneBounds.y + Math.round((laneBounds.height - totalHeight) / 2);
    for (const row of rows) {
      const rowHeight = Math.max(...row.map((record) => record.bounds.height));
      const centerY = recordY + rowHeight / 2;
      for (const record of row) {
        record.bounds.y = centerY - record.bounds.height / 2;
      }
      recordY += rowHeight + VERTICAL_GAP;
    }
  }
}
function flattenLanes(laneSets) {
  const lanes = [];
  for (const laneSet of laneSets) {
    for (const lane of laneSet.lanes || []) {
      lanes.push(lane);
      lanes.push(...flattenLanes(lane.childLaneSet ? [lane.childLaneSet] : []));
    }
  }
  return lanes;
}
function laneContains(ancestor, candidate) {
  return flattenLanes(ancestor.childLaneSet ? [ancestor.childLaneSet] : []).includes(candidate);
}
function addLaneLayout(lane, y, height, width, layout, laneHeights) {
  layout.shapes.set(lane, bounds(0, y, width, height));
  const children = lane.childLaneSet?.lanes || [];
  if (!children.length) {
    return;
  }
  let childY = y;
  for (const child of children) {
    const childHeight = laneHeights.get(child);
    addLaneLayout(child, childY, childHeight, width, layout, laneHeights);
    childY += childHeight;
  }
}
function placeBoundaryEvents(records, recordsByElement) {
  const boundaries = records.filter((record) => record.isBoundary);
  const byHost = /* @__PURE__ */ new Map();
  for (const record of boundaries) {
    const host = record.element.attachedToRef;
    if (!byHost.has(host)) {
      byHost.set(host, []);
    }
    byHost.get(host).push(record);
  }
  for (const [host, attachers] of byHost) {
    const hostRecord = recordsByElement.get(host);
    const hostBounds = hostRecord.bounds;
    const top = attachers.filter((record) => hasEventDefinition(record.element, "bpmn:EscalationEventDefinition"));
    const bottom = attachers.filter((record) => !top.includes(record));
    placeAttachers(top, hostBounds, true, recordsByElement);
    placeAttachers(bottom, hostBounds, false, recordsByElement);
  }
}
function placeAttachers(records, hostBounds, onTop, recordsByElement) {
  const outward = onTop ? -1 : 1;
  records.sort((a, b) => {
    const aDistance = boundaryHandlerDistance(a, hostBounds, outward, recordsByElement);
    const bDistance = boundaryHandlerDistance(b, hostBounds, outward, recordsByElement);
    return bDistance - aDistance || a.index - b.index;
  }).forEach((record, index) => {
    const x = Math.round(hostBounds.x + hostBounds.width / 2 + (index - (records.length - 1) / 2) * (record.size.width + BOUNDARY_EVENT_SPACING) - record.size.width / 2);
    const y = onTop ? hostBounds.y - record.size.height / 2 : hostBounds.y + hostBounds.height - record.size.height / 2;
    record.bounds = bounds(x, y, record.size.width, record.size.height);
  });
}
function boundaryHandlerDistance(record, hostBounds, outward, recordsByElement) {
  const targets = (record.element.outgoing || []).map((flow) => recordsByElement.get(flow.targetRef)?.bounds).filter(Boolean);
  if (!targets.length) {
    return 0;
  }
  const targetCenterY = targets.reduce((sum, target) => {
    return sum + target.y + target.height / 2;
  }, 0) / targets.length;
  const hostSideY = onHostSide(hostBounds, outward);
  return outward * (targetCenterY - hostSideY);
}
function onHostSide(hostBounds, outward) {
  return outward < 0 ? hostBounds.y : hostBounds.y + hostBounds.height;
}
function routeConnection(flow, source, target, shapes, routedConnections, policy) {
  if (flow.sourceRef === flow.targetRef) {
    return routeSelfLoop(flow, source, target, shapes);
  }
  if (is(flow.sourceRef, "bpmn:BoundaryEvent") && flow.sourceRef.attachedToRef === flow.targetRef) {
    return routeSelfLoop(flow, source, target, shapes);
  }
  const feedback = policy.backEdges?.has(flow);
  const isBack = feedback || target.x < source.x;
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterY = target.y + target.height / 2;
  const sameSemanticBand = (policy.bands.get(flow.sourceRef) || 0) === (policy.bands.get(flow.targetRef) || 0);
  const horizontalTargetDock = !isBack && sameSemanticBand && sourceCenterY >= target.y && sourceCenterY <= target.y + target.height;
  const targetDockY = horizontalTargetDock ? sourceCenterY : targetCenterY;
  const forwardStart = point(source.x + source.width, sourceCenterY);
  const forwardEnd = point(target.x, targetDockY);
  const longForward = !isBack && sourceCenterY === targetCenterY && !segmentIsClear(forwardStart, forwardEnd, shapes, flow.sourceRef, flow.targetRef, []);
  const sourceBoundary = is(flow.sourceRef, "bpmn:BoundaryEvent");
  const sourceDefinition = flow.sourceRef.eventDefinitions || [];
  const sourceTop = sourceBoundary && sourceDefinition.some((definition) => is(definition, "bpmn:EscalationEventDefinition"));
  const boundaryRejoin = sourceBoundary && [...policy.spine || []].some((edge) => edge.targetRef === flow.targetRef);
  const splitBranch = !isBack && !policy.straightEdges?.has(flow) && (flow.sourceRef.outgoing || []).length > 1 && sourceCenterY !== targetCenterY;
  const gatewayBranch = splitBranch && is(flow.sourceRef, "bpmn:Gateway");
  const boundaryBranch = splitBranch && sourceBoundary;
  const implicitBranch = splitBranch && !gatewayBranch && !boundaryBranch;
  const crossBand = !isBack && !sourceBoundary && !horizontalTargetDock && sourceCenterY !== targetCenterY;
  const verticalTarget = crossBand && !splitBranch;
  const alignedCrossBand = crossBand && sourceCenterX === targetCenterX;
  const gatewayCrossBand = !isBack && is(flow.sourceRef, "bpmn:Gateway") && (flow.sourceRef.outgoing || []).length > 1 && sourceCenterY !== targetCenterY;
  const gatewayTargetAbove = gatewayCrossBand && targetCenterY < sourceCenterY;
  const targetFromAbove = crossBand && sourceCenterY < targetCenterY;
  const start = sourceBoundary ? point(source.x + source.width / 2, sourceTop ? source.y : source.y + source.height) : alignedCrossBand ? point(sourceCenterX, targetCenterY < sourceCenterY ? source.y : source.y + source.height) : gatewayCrossBand ? point(
    source.x + source.width / 2,
    gatewayTargetAbove ? source.y : source.y + source.height
  ) : feedback || longForward ? point(source.x + source.width / 2, source.y + source.height) : isBack ? point(source.x, source.y + source.height / 2) : point(source.x + source.width, source.y + source.height / 2);
  let end = feedback || longForward ? point(target.x + target.width / 2, target.y + target.height) : boundaryRejoin ? point(target.x + target.width / 2, sourceTop ? target.y : target.y + target.height) : verticalTarget ? point(target.x + target.width / 2, targetFromAbove ? target.y : target.y + target.height) : isBack ? point(target.x + target.width, target.y + target.height / 2) : point(target.x, targetDockY);
  if (boundaryRejoin) {
    end = findClearVerticalDock(
      target,
      sourceTop,
      shapes,
      flow.sourceRef,
      flow.targetRef
    );
  }
  if (!isBack && start.y === end.y && segmentIsClear(start, end, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
    return [start, end];
  }
  if (gatewayBranch || boundaryBranch) {
    const branchRoute = cleanPoints([start, point(start.x, end.y), end]);
    if (pathIsClear(branchRoute, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
      return branchRoute;
    }
  }
  if (implicitBranch) {
    const channelX = Math.round((start.x + end.x) / 2);
    const branchRoute = cleanPoints([
      start,
      point(channelX, start.y),
      point(channelX, end.y),
      end
    ]);
    if (pathIsClear(branchRoute, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
      return branchRoute;
    }
  }
  if (crossBand) {
    const joinRoute = cleanPoints([start, point(end.x, start.y), end]);
    if (pathIsClear(joinRoute, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
      return joinRoute;
    }
    const targetAbove = targetCenterY < sourceCenterY;
    const centeredEndpoints = (is(flow.sourceRef, "bpmn:Event") || is(flow.sourceRef, "bpmn:Gateway")) && (is(flow.targetRef, "bpmn:Event") || is(flow.targetRef, "bpmn:Gateway"));
    if (centeredEndpoints) {
      const facingStart = point(
        sourceCenterX,
        targetAbove ? source.y : source.y + source.height
      );
      const facingEnd = point(
        targetCenterX,
        targetAbove ? target.y + target.height : target.y
      );
      for (let attempt = 1; attempt <= MAX_ROUTE_SEARCH_ATTEMPTS; attempt++) {
        const channelY2 = facingEnd.y + (targetAbove ? 1 : -1) * attempt * ROUTING_MARGIN;
        if (targetAbove && channelY2 >= facingStart.y || !targetAbove && channelY2 <= facingStart.y) {
          break;
        }
        const facingRoute = cleanPoints([
          facingStart,
          point(facingStart.x, channelY2),
          point(facingEnd.x, channelY2),
          facingEnd
        ]);
        if (pathIsClear(
          facingRoute,
          shapes,
          flow.sourceRef,
          flow.targetRef,
          routedConnections
        )) {
          return facingRoute;
        }
      }
    }
    const transposedStart = point(
      sourceCenterX,
      targetAbove ? source.y : source.y + source.height
    );
    const transposedEnd = point(
      sourceCenterX < targetCenterX ? target.x : target.x + target.width,
      targetCenterY
    );
    const transposedRoute = cleanPoints([
      transposedStart,
      point(transposedStart.x, transposedEnd.y),
      transposedEnd
    ]);
    if (pathIsClear(
      transposedRoute,
      shapes,
      flow.sourceRef,
      flow.targetRef,
      routedConnections
    )) {
      return transposedRoute;
    }
  }
  if (longForward || feedback && !sourceBoundary) {
    const localBypass = findLocalUBypass(
      flow,
      start,
      end,
      shapes,
      policy,
      routedConnections
    );
    if (localBypass) {
      return localBypass;
    }
  }
  const extents = getShapeExtents(shapes);
  if (boundaryRejoin) {
    for (let attempt = 1; attempt <= MAX_ROUTE_SEARCH_ATTEMPTS; attempt++) {
      const spacing = attempt * ROUTING_MARGIN;
      const channelY2 = sourceTop ? Math.min(start.y, end.y) - spacing : Math.max(start.y, end.y) + spacing;
      const rejoinRoute = cleanPoints([
        start,
        point(start.x, channelY2),
        point(end.x, channelY2),
        end
      ]);
      if (pathIsClear(rejoinRoute, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
        return rejoinRoute;
      }
    }
  }
  if (feedback || longForward) {
    for (let attempt = 1; attempt <= MAX_ROUTE_SEARCH_ATTEMPTS; attempt++) {
      const channelY2 = extents.maxY + attempt * ROUTING_MARGIN;
      const backRoute = cleanPoints([
        start,
        point(start.x, channelY2),
        point(end.x, channelY2),
        end
      ]);
      if (pathIsClear(backRoute, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
        return backRoute;
      }
    }
  }
  const channelY = isBack ? extents.maxY + ROUTING_MARGIN : sourceBoundary ? end.y : sourceTop ? Math.min(start.y, end.y) - ROUTING_MARGIN : Math.max(start.y, end.y) + ROUTING_MARGIN;
  const leadX = isBack ? Math.min(start.x, end.x) - ROUTING_MARGIN : Math.round((start.x + end.x) / 2);
  const preferred = cleanPoints([
    start,
    point(sourceBoundary ? start.x : leadX, start.y),
    point(sourceBoundary ? start.x : leadX, channelY),
    point(end.x, channelY),
    end
  ]);
  if (pathIsClear(preferred, shapes, flow.sourceRef, flow.targetRef, routedConnections)) {
    return preferred;
  }
  const route = visibilityRoute(start, end, shapes, flow.sourceRef, flow.targetRef, routedConnections) || visibilityRoute(start, end, shapes, flow.sourceRef, flow.targetRef, []);
  if (route) {
    return route;
  }
  const outerRoute = findOuterRoute(
    start,
    end,
    shapes,
    flow.sourceRef,
    flow.targetRef,
    routedConnections,
    isBack,
    sourceBoundary,
    sourceTop
  ) || findOuterRoute(
    start,
    end,
    shapes,
    flow.sourceRef,
    flow.targetRef,
    [],
    isBack,
    sourceBoundary,
    sourceTop
  );
  if (outerRoute) {
    return outerRoute;
  }
  const perimeterRoute = findPerimeterRoute(
    source,
    target,
    shapes,
    flow.sourceRef,
    flow.targetRef,
    routedConnections
  ) || findPerimeterRoute(
    source,
    target,
    shapes,
    flow.sourceRef,
    flow.targetRef,
    []
  );
  if (!perimeterRoute) {
    throw new LayoutError(
      "ROUTING_FAILED",
      flow.id,
      `No legal orthogonal route could be found without crossing a shape (${flow.id}).`
    );
  }
  return perimeterRoute;
}
function routeSelfLoop(flow, source, target, shapes) {
  const start = point(source.x + source.width / 2, source.y + source.height);
  const end = point(target.x, target.y + target.height / 2);
  for (let attempt = 1; attempt <= MAX_ROUTE_SEARCH_ATTEMPTS; attempt++) {
    const spacing = attempt * ROUTING_MARGIN;
    const channelX = target.x - spacing;
    const channelY = Math.max(
      source.y + source.height,
      target.y + target.height
    ) + spacing;
    const candidate = [
      start,
      point(start.x, channelY),
      point(channelX, channelY),
      point(channelX, end.y),
      end
    ];
    if (pathIsClear(candidate, shapes, flow.sourceRef, flow.targetRef, [])) {
      return candidate;
    }
  }
  throw new LayoutError(
    "ROUTING_FAILED",
    flow.id,
    `No legal self-loop route could be found without crossing a shape (${flow.id}).`
  );
}
function findClearVerticalDock(target, onTop, shapes, sourceElement, targetElement) {
  const y = onTop ? target.y : target.y + target.height;
  const candidates = CLEAR_DOCK_X_FRACTIONS.map((offset) => {
    return point(target.x + target.width * offset, y);
  });
  return candidates.find((candidate) => {
    const outside = point(candidate.x, candidate.y + (onTop ? -ROUTING_MARGIN : ROUTING_MARGIN));
    return segmentIsClear(outside, candidate, shapes, sourceElement, targetElement, []);
  }) || candidates[0];
}
function findLocalUBypass(flow, start, end, shapes, policy, routedConnections) {
  const sourceElement = flow.sourceRef;
  const targetElement = flow.targetRef;
  const shapeByElement = new Map(shapes.map(({ element, rect }) => [element, rect]));
  const source = shapeByElement.get(sourceElement);
  const target = shapeByElement.get(targetElement);
  const centerY = source.y + source.height / 2;
  const directStart = source.x < target.x ? point(source.x + source.width, centerY) : point(source.x, centerY);
  const directEnd = source.x < target.x ? point(target.x, centerY) : point(target.x + target.width, centerY);
  const blockers = shapes.filter(({ element, rect }) => {
    return element !== sourceElement && element !== targetElement && segmentEntersRect(directStart, directEnd, inset(rect, ROUTE_OBSTACLE_INSET));
  });
  const nearestBottom = Math.max(
    source.y + source.height,
    target.y + target.height,
    ...blockers.map(({ rect }) => rect.y + rect.height)
  );
  const depth = uShapeDepth(flow, shapes, policy);
  const isolated = !hasOverlappingUShape(flow, shapes, policy);
  const balancedDefault = sourceElement.default === flow && isolated;
  const nearestTop = Math.min(
    source.y,
    target.y,
    ...blockers.map(({ rect }) => rect.y)
  );
  const topStart = point(source.x + source.width / 2, source.y);
  const topEnd = point(target.x + target.width / 2, target.y);
  if (!balancedDefault) {
    return findClearLocalUChannel(
      start,
      end,
      nearestBottom,
      1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      routedConnections
    ) || findClearLocalUChannel(
      start,
      end,
      nearestBottom,
      1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      []
    ) || findClearLocalUChannel(
      topStart,
      topEnd,
      nearestTop,
      -1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      routedConnections
    ) || findClearLocalUChannel(
      topStart,
      topEnd,
      nearestTop,
      -1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      []
    );
  }
  for (const connections of [routedConnections, []]) {
    const bottom = findClearLocalUChannel(
      start,
      end,
      nearestBottom,
      1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      connections
    );
    const top = findClearLocalUChannel(
      topStart,
      topEnd,
      nearestTop,
      -1,
      depth,
      shapes,
      sourceElement,
      targetElement,
      connections
    );
    const candidates = [top, bottom].filter(Boolean);
    if (candidates.length) {
      return candidates.sort((a, b) => routeLength(a) - routeLength(b))[0];
    }
  }
  return null;
}
function findClearLocalUChannel(start, end, nearest, direction, depth, shapes, sourceElement, targetElement, routedConnections) {
  for (let attempt = 0; attempt < MAX_LOCAL_U_CHANNEL_ATTEMPTS; attempt++) {
    const channelY = nearest + direction * (depth + attempt) * ROUTING_MARGIN;
    const candidate = cleanPoints([
      start,
      point(start.x, channelY),
      point(end.x, channelY),
      end
    ]);
    if (pathIsClear(
      candidate,
      shapes,
      sourceElement,
      targetElement,
      routedConnections,
      -3
    )) {
      return candidate;
    }
  }
  return null;
}
function uShapeDepth(flow, shapes, policy) {
  const shapeByElement = new Map(shapes.map(({ element, rect }) => [element, rect]));
  const candidates = uShapeCandidates(shapes, policy, shapeByElement);
  const memo = /* @__PURE__ */ new Map();
  const depth = (edge) => {
    if (memo.has(edge)) {
      return memo.get(edge);
    }
    const [left, right] = uShapeSpan(edge, shapeByElement);
    const nested = candidates.filter((other) => {
      if (other === edge) {
        return false;
      }
      const otherSource = shapeByElement.get(other.sourceRef);
      const [otherLeft] = uShapeSpan(other, shapeByElement);
      return otherSource.y + otherSource.height / 2 === shapeByElement.get(edge.sourceRef).y + shapeByElement.get(edge.sourceRef).height / 2 && otherLeft > left && otherLeft < right;
    });
    const value = 1 + Math.max(0, ...nested.map(depth));
    memo.set(edge, value);
    return value;
  };
  return depth(flow);
}
function hasOverlappingUShape(flow, shapes, policy) {
  const shapeByElement = new Map(shapes.map(({ element, rect }) => [element, rect]));
  const source = shapeByElement.get(flow.sourceRef);
  const [left, right] = uShapeSpan(flow, shapeByElement);
  return uShapeCandidates(shapes, policy, shapeByElement).some((other) => {
    if (other === flow) {
      return false;
    }
    const otherSource = shapeByElement.get(other.sourceRef);
    const [otherLeft, otherRight] = uShapeSpan(other, shapeByElement);
    return otherSource.y + otherSource.height / 2 === source.y + source.height / 2 && otherLeft < right && otherRight > left;
  });
}
function uShapeCandidates(shapes, policy, shapeByElement) {
  return (policy.graphEdges || []).filter((edge) => {
    const source = shapeByElement.get(edge.sourceRef);
    const target = shapeByElement.get(edge.targetRef);
    if (!source || !target || source.y + source.height / 2 !== target.y + target.height / 2) {
      return false;
    }
    if (policy.backEdges?.has(edge)) {
      return true;
    }
    const start = point(source.x + source.width, source.y + source.height / 2);
    const end = point(target.x, target.y + target.height / 2);
    return target.x >= source.x && !segmentIsClear(start, end, shapes, edge.sourceRef, edge.targetRef, []);
  });
}
function uShapeSpan(edge, shapeByElement) {
  const source = shapeByElement.get(edge.sourceRef);
  const target = shapeByElement.get(edge.targetRef);
  return [
    Math.min(source.x, target.x),
    Math.max(source.x + source.width, target.x + target.width)
  ];
}
function findOuterRoute(start, end, shapes, sourceElement, targetElement, routedConnections, isBack, sourceBoundary, sourceTop) {
  const extents = getShapeExtents(shapes);
  for (let attempt = 1; attempt <= MAX_ROUTE_SEARCH_ATTEMPTS; attempt++) {
    const spacing = ROUTING_MARGIN * attempt;
    const channelY = sourceBoundary && sourceTop ? extents.minY - spacing : extents.maxY + spacing;
    const exitX = isBack ? start.x - spacing : start.x + spacing;
    const entryX = isBack ? end.x + spacing : end.x - spacing;
    const candidate = cleanPoints([
      start,
      point(sourceBoundary ? start.x : exitX, start.y),
      point(sourceBoundary ? start.x : exitX, channelY),
      point(entryX, channelY),
      point(entryX, end.y),
      end
    ]);
    if (pathIsClear(candidate, shapes, sourceElement, targetElement, routedConnections)) {
      return candidate;
    }
  }
  return null;
}
function findPerimeterRoute(source, target, shapes, sourceElement, targetElement, routedConnections) {
  const extents = getShapeExtents(shapes);
  const corners = [
    point(extents.minX - ROUTING_MARGIN, extents.minY - ROUTING_MARGIN),
    point(extents.maxX + ROUTING_MARGIN, extents.minY - ROUTING_MARGIN),
    point(extents.minX - ROUTING_MARGIN, extents.maxY + ROUTING_MARGIN),
    point(extents.maxX + ROUTING_MARGIN, extents.maxY + ROUTING_MARGIN)
  ];
  for (const corner of corners) {
    const sourceLegs = outerLegs(source, corner);
    const targetLegs = outerLegs(target, corner);
    for (const sourceLeg of sourceLegs) {
      for (const targetLeg of targetLegs) {
        const route = cleanPoints([
          ...sourceLeg,
          ...targetLeg.slice().reverse().slice(1)
        ]);
        if (pathIsClear(route, shapes, sourceElement, targetElement, routedConnections)) {
          return route;
        }
      }
    }
  }
  return null;
}
function outerLegs(rect, corner) {
  const horizontalPort = point(
    corner.x < rect.x ? rect.x : rect.x + rect.width,
    rect.y + rect.height / 2
  );
  const verticalPort = point(
    rect.x + rect.width / 2,
    corner.y < rect.y ? rect.y : rect.y + rect.height
  );
  return [
    [horizontalPort, point(corner.x, horizontalPort.y), corner],
    [verticalPort, point(verticalPort.x, corner.y), corner]
  ];
}
function visibilityRoute(start, end, shapes, sourceElement, targetElement, routedConnections, obstacleInset = ROUTE_OBSTACLE_INSET, allowPerpendicularCrossings = false) {
  const extents = getShapeExtents(shapes);
  const xs = /* @__PURE__ */ new Set([start.x, end.x, extents.minX - ROUTING_MARGIN, extents.maxX + ROUTING_MARGIN]);
  const ys = /* @__PURE__ */ new Set([start.y, end.y, extents.minY - ROUTING_MARGIN, extents.maxY + ROUTING_MARGIN]);
  for (const { rect } of shapes) {
    xs.add(rect.x - ROUTING_MARGIN);
    xs.add(rect.x + rect.width + ROUTING_MARGIN);
    ys.add(rect.y - ROUTING_MARGIN);
    ys.add(rect.y + rect.height + ROUTING_MARGIN);
  }
  const points = [];
  for (const x of xs) {
    for (const y of ys) {
      const candidate = point(x, y);
      if (!isInsideAny(candidate, shapes, sourceElement, targetElement)) {
        points.push(candidate);
      }
    }
  }
  const startIndex = points.push(start) - 1;
  const endIndex = points.push(end) - 1;
  const { pointsByX, pointsByY } = indexVisibilityPoints(points);
  const distance = Array(points.length).fill(Infinity);
  const previous = Array(points.length).fill(-1);
  const pending = new Set(points.map((_, index) => index));
  const queue = [];
  const segmentIsClear2 = createVisibilitySegmentChecker(
    shapes,
    sourceElement,
    targetElement,
    routedConnections,
    obstacleInset,
    allowPerpendicularCrossings
  );
  distance[startIndex] = 0;
  pushVisibilityNode(queue, { index: startIndex, distance: 0 });
  while (queue.length) {
    const entry = popVisibilityNode(queue);
    const current = entry.index;
    if (!pending.has(current) || entry.distance !== distance[current]) {
      continue;
    }
    pending.delete(current);
    if (current === endIndex) {
      break;
    }
    const vertical = pointsByX.get(points[current].x) || [];
    const horizontal = pointsByY.get(points[current].y) || [];
    let verticalIndex = 0;
    let horizontalIndex = 0;
    while (verticalIndex < vertical.length || horizontalIndex < horizontal.length) {
      const verticalNext = vertical[verticalIndex] ?? Infinity;
      const horizontalNext = horizontal[horizontalIndex] ?? Infinity;
      const next = Math.min(verticalNext, horizontalNext);
      if (verticalNext === next) {
        verticalIndex++;
      }
      if (horizontalNext === next) {
        horizontalIndex++;
      }
      if (!pending.has(next)) {
        continue;
      }
      if (!segmentIsClear2(points[current], points[next])) {
        continue;
      }
      const candidate = distance[current] + manhattan(points[current], points[next]) + VISIBILITY_GRAPH_TURN_PENALTY;
      if (candidate < distance[next]) {
        distance[next] = candidate;
        previous[next] = current;
        pushVisibilityNode(queue, { index: next, distance: candidate });
      }
    }
  }
  if (distance[endIndex] === Infinity) {
    return null;
  }
  const route = [];
  for (let current = endIndex; current !== -1; current = previous[current]) {
    route.unshift(points[current]);
  }
  return cleanPoints(route);
}
function createVisibilitySegmentChecker(shapes, sourceElement, targetElement, routedConnections, obstacleInset, allowPerpendicularCrossings) {
  const obstacles = shapes.filter(({ element }) => element !== sourceElement && element !== targetElement).map(({ rect }) => inset(rect, obstacleInset));
  const connections = routedConnections.map((connection) => {
    return {
      segments: toSegments(connection.points),
      sharedEndpoint: sharesEndpointChannel(
        connection.flow,
        sourceElement,
        targetElement
      )
    };
  });
  return (a, b) => {
    if (a.x === b.x && a.y === b.y) {
      return false;
    }
    if (obstacles.some((rect) => segmentEntersRect(a, b, rect))) {
      return false;
    }
    return !connections.some((connection) => {
      return connection.segments.some(([c, d]) => {
        return !allowPerpendicularCrossings && segmentsProperlyCross(a, b, c, d) || !connection.sharedEndpoint && collinearOverlap(a, b, c, d);
      });
    });
  };
}
function indexVisibilityPoints(points) {
  const pointsByX = /* @__PURE__ */ new Map();
  const pointsByY = /* @__PURE__ */ new Map();
  points.forEach((candidate, index) => {
    if (!Number.isNaN(candidate.x)) {
      appendVisibilityPoint(pointsByX, candidate.x, index);
    }
    if (!Number.isNaN(candidate.y)) {
      appendVisibilityPoint(pointsByY, candidate.y, index);
    }
  });
  return { pointsByX, pointsByY };
}
function appendVisibilityPoint(index, coordinate, pointIndex) {
  const points = index.get(coordinate);
  if (points) {
    points.push(pointIndex);
  } else {
    index.set(coordinate, [pointIndex]);
  }
}
function pushVisibilityNode(queue, entry) {
  queue.push(entry);
  let index = queue.length - 1;
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (compareVisibilityNodes(queue[parentIndex], entry) <= 0) {
      break;
    }
    queue[index] = queue[parentIndex];
    index = parentIndex;
  }
  queue[index] = entry;
}
function popVisibilityNode(queue) {
  const first = queue[0];
  const last = queue.pop();
  if (queue.length) {
    let index = 0;
    while (index * 2 + 1 < queue.length) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      const childIndex = rightIndex < queue.length && compareVisibilityNodes(queue[rightIndex], queue[leftIndex]) < 0 ? rightIndex : leftIndex;
      if (compareVisibilityNodes(last, queue[childIndex]) <= 0) {
        break;
      }
      queue[index] = queue[childIndex];
      index = childIndex;
    }
    queue[index] = last;
  }
  return first;
}
function compareVisibilityNodes(a, b) {
  return a.distance - b.distance || a.index - b.index;
}
function segmentIsClear(a, b, shapes, sourceElement, targetElement, routedConnections, obstacleInset = ROUTE_OBSTACLE_INSET, allowPerpendicularCrossings = false) {
  if (a.x === b.x && a.y === b.y) {
    return false;
  }
  for (const { element, rect } of shapes) {
    if (element === sourceElement || element === targetElement) {
      continue;
    }
    if (segmentEntersRect(a, b, inset(rect, obstacleInset))) {
      return false;
    }
  }
  return !routedConnections.some((connection) => {
    const sharedEndpoint = sharesEndpointChannel(
      connection.flow,
      sourceElement,
      targetElement
    );
    return toSegments(connection.points).some(([c, d]) => {
      return !allowPerpendicularCrossings && segmentsProperlyCross(a, b, c, d) || !sharedEndpoint && collinearOverlap(a, b, c, d);
    });
  });
}
function sharesEndpointChannel(flow, source, target) {
  return flow.sourceRef === source || flow.targetRef === target || flow.$instanceOf("bpmn:MessageFlow") && (flow.sourceRef === target && flow.targetRef !== source || flow.targetRef === source && flow.sourceRef !== target);
}
function pathIsClear(points, shapes, sourceElement, targetElement, routedConnections, obstacleInset = ROUTE_OBSTACLE_INSET) {
  return toSegments(points).every(([a, b]) => {
    return segmentIsClear(
      a,
      b,
      shapes,
      sourceElement,
      targetElement,
      routedConnections,
      obstacleInset
    );
  });
}
function isInsideAny(candidate, shapes, sourceElement, targetElement) {
  return shapes.some(({ element, rect }) => {
    return element !== sourceElement && element !== targetElement && pointInRect(candidate, rect);
  });
}
function findContainingArtifactContainers(elementBounds, shapes) {
  const center = {
    x: elementBounds.x + elementBounds.width / 2,
    y: elementBounds.y + elementBounds.height / 2
  };
  return [...shapes.entries()].filter(([element, rect]) => {
    return (is(element, "bpmn:Lane") || is(element, "bpmn:Participant") || is(element, "bpmn:SubProcess")) && center.x >= rect.x && center.x <= rect.x + rect.width && center.y >= rect.y && center.y <= rect.y + rect.height;
  }).map(([, rect]) => rect).sort((a, b) => a.width * a.height - b.width * b.height);
}
function associationConnection(association, owner, ownerBounds, artifact, artifactBounds, connectionIndex = 0, connectionCount = 1, obstacles = [], routeSegments = []) {
  const artifactIsSource = is(association, "bpmn:DataInputAssociation") || association.sourceRef === artifact || Array.isArray(association.sourceRef) && association.sourceRef.includes(artifact);
  const dataArtifact = is(artifact, "bpmn:DataObjectReference") || is(artifact, "bpmn:DataStoreReference");
  if (dataArtifact) {
    const points = orthogonalAssociationRoute(
      owner,
      ownerBounds,
      artifact,
      artifactBounds,
      obstacles,
      routeSegments,
      connectionIndex,
      connectionCount
    );
    return artifactIsSource ? points : points.reverse();
  }
  let ownerPoint;
  let artifactPoint;
  if (artifactBounds.y + artifactBounds.height <= ownerBounds.y) {
    const offset = associationDockOffset(
      ownerBounds.width,
      artifactBounds.width,
      connectionIndex,
      connectionCount
    );
    ownerPoint = point(ownerBounds.x + ownerBounds.width / 2 + offset, ownerBounds.y);
    artifactPoint = point(
      artifactBounds.x + artifactBounds.width / 2 + offset,
      artifactBounds.y + artifactBounds.height
    );
  } else if (ownerBounds.y + ownerBounds.height <= artifactBounds.y) {
    const offset = associationDockOffset(
      ownerBounds.width,
      artifactBounds.width,
      connectionIndex,
      connectionCount
    );
    ownerPoint = point(
      ownerBounds.x + ownerBounds.width / 2 + offset,
      ownerBounds.y + ownerBounds.height
    );
    artifactPoint = point(
      artifactBounds.x + artifactBounds.width / 2 + offset,
      artifactBounds.y
    );
  } else if (artifactBounds.x + artifactBounds.width <= ownerBounds.x) {
    const offset = associationDockOffset(
      ownerBounds.height,
      artifactBounds.height,
      connectionIndex,
      connectionCount
    );
    ownerPoint = point(ownerBounds.x, ownerBounds.y + ownerBounds.height / 2 + offset);
    artifactPoint = point(
      artifactBounds.x + artifactBounds.width,
      artifactBounds.y + artifactBounds.height / 2 + offset
    );
  } else if (ownerBounds.x + ownerBounds.width <= artifactBounds.x) {
    const offset = associationDockOffset(
      ownerBounds.height,
      artifactBounds.height,
      connectionIndex,
      connectionCount
    );
    ownerPoint = point(
      ownerBounds.x + ownerBounds.width,
      ownerBounds.y + ownerBounds.height / 2 + offset
    );
    artifactPoint = point(
      artifactBounds.x,
      artifactBounds.y + artifactBounds.height / 2 + offset
    );
  } else {
    const artifactAbove = artifactBounds.y + artifactBounds.height / 2 < ownerBounds.y + ownerBounds.height / 2;
    const offset = associationDockOffset(
      ownerBounds.width,
      artifactBounds.width,
      connectionIndex,
      connectionCount
    );
    ownerPoint = point(
      ownerBounds.x + ownerBounds.width / 2 + offset,
      artifactAbove ? ownerBounds.y : ownerBounds.y + ownerBounds.height
    );
    artifactPoint = point(
      artifactBounds.x + artifactBounds.width / 2 + offset,
      artifactAbove ? artifactBounds.y + artifactBounds.height : artifactBounds.y
    );
  }
  return artifactIsSource ? [artifactPoint, ownerPoint] : [ownerPoint, artifactPoint];
}
function associationDockOffset(ownerSpan, artifactSpan, index, count) {
  if (count < 2) {
    return 0;
  }
  const span = Math.min(ownerSpan, artifactSpan);
  return (index + 1) * span / (count + 1) - span / 2;
}
function orthogonalAssociationRoute(owner, ownerBounds, artifact, artifactBounds, obstacles, routeSegments, connectionIndex, connectionCount) {
  const horizontal = horizontalAssociationDocks(
    artifactBounds,
    ownerBounds,
    connectionIndex,
    connectionCount
  );
  const vertical = verticalAssociationDocks(
    artifactBounds,
    ownerBounds,
    connectionIndex,
    connectionCount
  );
  const centeredIndex = connectionIndex - (connectionCount - 1) / 2;
  const channelOffset = centeredIndex * ROUTING_MARGIN;
  const candidates = [
    {
      points: [
        horizontal.artifact,
        point(vertical.owner.x, horizontal.artifact.y),
        vertical.owner
      ],
      artifactAxis: "horizontal",
      ownerAxis: "vertical"
    },
    {
      points: [
        vertical.artifact,
        point(vertical.artifact.x, horizontal.owner.y),
        horizontal.owner
      ],
      artifactAxis: "vertical",
      ownerAxis: "horizontal"
    },
    {
      points: [
        horizontal.artifact,
        point(
          (horizontal.artifact.x + horizontal.owner.x) / 2 + channelOffset,
          horizontal.artifact.y
        ),
        point(
          (horizontal.artifact.x + horizontal.owner.x) / 2 + channelOffset,
          horizontal.owner.y
        ),
        horizontal.owner
      ],
      artifactAxis: "horizontal",
      ownerAxis: "horizontal"
    },
    {
      points: [
        vertical.artifact,
        point(
          vertical.artifact.x,
          (vertical.artifact.y + vertical.owner.y) / 2 + channelOffset
        ),
        point(
          vertical.owner.x,
          (vertical.artifact.y + vertical.owner.y) / 2 + channelOffset
        ),
        vertical.owner
      ],
      artifactAxis: "vertical",
      ownerAxis: "vertical"
    }
  ].map((candidate) => ({
    ...candidate,
    points: simplifyOrthogonalRoute(candidate.points)
  })).filter(({ points, artifactAxis, ownerAxis }) => {
    return routeHasDockDirections(points, artifactAxis, ownerAxis);
  });
  return candidates.map(({ points }, index) => {
    const clear = routeAvoidsEndpointInteriors(
      points,
      artifactBounds,
      ownerBounds
    ) && pathIsClear(
      points,
      obstacles,
      owner,
      artifact,
      [],
      -1
    );
    return {
      points,
      score: [
        clear ? 0 : 1,
        routeCrossings(points, routeSegments),
        points.length - 2,
        index,
        routeLength(points)
      ]
    };
  }).sort((a, b) => compareScores(a.score, b.score))[0].points;
}
function routeAvoidsEndpointInteriors(points, artifactBounds, ownerBounds) {
  return toSegments(points).every(([start, end]) => {
    return !segmentEntersRect(start, end, artifactBounds) && !segmentEntersRect(start, end, ownerBounds);
  });
}
function routeHasDockDirections(points, artifactAxis, ownerAxis) {
  const first = points[0];
  const second = points[1];
  const penultimate = points.at(-2);
  const last = points.at(-1);
  const firstAxis = first.y === second.y ? "horizontal" : "vertical";
  const lastAxis = penultimate.y === last.y ? "horizontal" : "vertical";
  return firstAxis === artifactAxis && lastAxis === ownerAxis;
}
function horizontalAssociationDocks(artifactBounds, ownerBounds, connectionIndex, connectionCount) {
  const artifactLeft = artifactBounds.x + artifactBounds.width / 2 < ownerBounds.x + ownerBounds.width / 2;
  const offset = associationDockOffset(
    ownerBounds.height,
    artifactBounds.height,
    connectionIndex,
    connectionCount
  );
  return {
    artifact: point(
      artifactLeft ? artifactBounds.x + artifactBounds.width : artifactBounds.x,
      artifactBounds.y + artifactBounds.height / 2 + offset
    ),
    owner: point(
      artifactLeft ? ownerBounds.x : ownerBounds.x + ownerBounds.width,
      ownerBounds.y + ownerBounds.height / 2 + offset
    )
  };
}
function verticalAssociationDocks(artifactBounds, ownerBounds, connectionIndex, connectionCount) {
  const artifactAbove = artifactBounds.y + artifactBounds.height / 2 < ownerBounds.y + ownerBounds.height / 2;
  const offset = associationDockOffset(
    ownerBounds.width,
    artifactBounds.width,
    connectionIndex,
    connectionCount
  );
  return {
    artifact: point(
      artifactBounds.x + artifactBounds.width / 2 + offset,
      artifactAbove ? artifactBounds.y + artifactBounds.height : artifactBounds.y
    ),
    owner: point(
      ownerBounds.x + ownerBounds.width / 2 + offset,
      artifactAbove ? ownerBounds.y : ownerBounds.y + ownerBounds.height
    )
  };
}
function simplifyOrthogonalRoute(points) {
  const deduplicated = points.filter((candidate, index) => {
    const previous = points[index - 1];
    return !previous || candidate.x !== previous.x || candidate.y !== previous.y;
  });
  return deduplicated.filter((candidate, index) => {
    const previous = deduplicated[index - 1];
    const next = deduplicated[index + 1];
    return !previous || !next || !(previous.x === candidate.x && candidate.x === next.x || previous.y === candidate.y && candidate.y === next.y);
  });
}
function artifactSizeCandidates(element) {
  if (!is(element, "bpmn:TextAnnotation")) {
    return [getDefaultSize(element)];
  }
  const text = element.text || "";
  const candidates = [];
  for (let width = ANNOTATION_MIN_WIDTH; width <= ANNOTATION_MAX_WIDTH; width += ANNOTATION_WIDTH_STEP) {
    const lineCount = wrappedTextLineCount(text, width);
    const height = Math.max(
      ANNOTATION_MIN_HEIGHT,
      lineCount * ANNOTATION_LINE_HEIGHT + 2 * ANNOTATION_PADDING
    );
    candidates.push({ width, height });
  }
  return candidates.sort((a, b) => {
    return annotationSizePenalty(a) - annotationSizePenalty(b) || a.width * a.height - b.width * b.height || a.width - b.width;
  });
}
function wrappedTextLineCount(text, width) {
  const capacity = Math.max(
    1,
    Math.floor((width - 2 * ANNOTATION_PADDING) / ANNOTATION_CHARACTER_WIDTH)
  );
  return String(text || "").split(/\r?\n/).reduce((total, paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return total + 1;
    }
    let lines = 1;
    let lineLength = 0;
    for (const word of words) {
      const wordLength = word.length;
      if (!lineLength) {
        lines += Math.max(0, Math.ceil(wordLength / capacity) - 1);
        lineLength = wordLength % capacity || Math.min(wordLength, capacity);
      } else if (lineLength + 1 + wordLength <= capacity) {
        lineLength += 1 + wordLength;
      } else {
        lines += Math.max(1, Math.ceil(wordLength / capacity));
        lineLength = wordLength % capacity || Math.min(wordLength, capacity);
      }
    }
    return total + lines;
  }, 0);
}
function annotationSizePenalty(size) {
  return Math.round(
    Math.abs(size.width / size.height - ANNOTATION_TARGET_ASPECT_RATIO) * ANNOTATION_ASPECT_RATIO_PENALTY_SCALE
  );
}
function findArtifactPlacement(artifact, ownerBounds, references, sizes, obstacles, routes, occupied, container, processContainer, extents, annotationClearance = 0, boundaryContainers = [], avoidParticipantInterior = false, preferParticipantSides = true, participantInteriorPreference = 0) {
  const preparedBoundaryContainers = boundaryContainers.map(({
    rect,
    containsOwner,
    participant
  }) => {
    return {
      containsOwner,
      participant,
      rect,
      headerRect: participant && {
        x: rect.x,
        y: rect.y,
        width: PARTICIPANT_HEADER_WIDTH,
        height: rect.height
      }
    };
  });
  const referenceOwnerBounds = [...new Set(
    references.map((reference) => reference.ownerBounds).filter(Boolean)
  )];
  const hasMultipleOwners = referenceOwnerBounds.length > 1;
  const localCandidates = ownerBounds ? referenceOwnerBounds.flatMap((referenceBounds) => {
    return ownedArtifactCandidates(artifact, referenceBounds, sizes);
  }) : unownedArtifactCandidates(sizes, extents);
  const candidates = is(artifact, "bpmn:TextAnnotation") ? [
    ...localCandidates,
    ...participantExteriorArtifactCandidates(
      sizes,
      ownerBounds,
      preparedBoundaryContainers,
      annotationClearance
    ),
    ...outerScopeArtifactCandidates(sizes, extents)
  ] : localCandidates;
  const obstacleBounds = obstacles.map(({ element, rect }) => {
    return is(element, "bpmn:BoundaryEvent") ? artifactObstacleBounds(rect) : rect;
  });
  const occupiedBounds = occupied.map(({ element, rect, annotationClearance: annotationClearance2 }) => {
    return artifactClearanceBounds(element, rect, annotationClearance2);
  });
  const routeSegments = routes.flatMap((route) => toSegments(route.points));
  const dataArtifact = is(artifact, "bpmn:DataObjectReference") || is(artifact, "bpmn:DataStoreReference");
  const requiresContainment = is(artifact, "bpmn:DataObjectReference");
  const rankedCandidates = candidates.map((candidate) => {
    const routedReferences = references.map(({
      association,
      owner,
      ownerBounds: ownerBounds2,
      ownerConnectionIndex,
      ownerConnectionCount
    }) => {
      const points = ownerBounds2 && associationConnection(
        association,
        owner,
        ownerBounds2,
        artifact,
        candidate.rect,
        ownerConnectionIndex,
        ownerConnectionCount,
        obstacles,
        routeSegments
      );
      return points && { owner, points };
    }).filter(Boolean);
    const directLength = dataArtifact ? ownerBalancedRouteLength(routedReferences) : routedReferences.reduce((total, { points }) => {
      return total + routeLength(points);
    }, 0);
    const associationCrossingCount = routedReferences.reduce((total, { points }) => {
      return total + routeCrossings(points, routeSegments);
    }, 0);
    const associationBendCount = dataArtifact ? routedReferences.reduce((total, { points }) => {
      return total + Math.max(0, points.length - 2);
    }, 0) : 0;
    const alignedOwnerCount = dataArtifact ? referenceOwnerBounds.filter((referenceBounds) => {
      return artifactIsAligned(candidate.rect, referenceBounds);
    }).length : 0;
    const missesOwnerAlignment = dataArtifact && referenceOwnerBounds.length > 0 && alignedOwnerCount === 0 ? 1 : 0;
    const congestionPenalty = hasMultipleOwners ? artifactCongestionPenalty(candidate.rect, obstacleBounds) : 0;
    const congestionViolation = congestionPenalty > 0 ? 1 : 0;
    const participantInteriorPenalty = (avoidParticipantInterior || participantInteriorPreference) && is(artifact, "bpmn:TextAnnotation") && preparedBoundaryContainers.some(({
      rect,
      containsOwner,
      participant
    }) => {
      return participant && containsOwner && artifactFitsContainer(candidate.rect, rect, 0);
    }) ? 1 : 0;
    const participantVerticalSidePenalty = preferParticipantSides && is(artifact, "bpmn:TextAnnotation") && preparedBoundaryContainers.some(({
      rect,
      containsOwner,
      participant
    }) => {
      return participant && containsOwner && (candidate.rect.y + candidate.rect.height <= rect.y || candidate.rect.y >= rect.y + rect.height);
    }) ? 1 : 0;
    const lowerBound = [
      avoidParticipantInterior ? participantInteriorPenalty : 0,
      dataArtifact ? associationCrossingCount : 0,
      congestionViolation,
      missesOwnerAlignment,
      -alignedOwnerCount,
      associationBendCount,
      directLength + congestionPenalty + participantInteriorPenalty * participantInteriorPreference + participantVerticalSidePenalty * 4 * VERTICAL_GAP,
      directLength,
      is(artifact, "bpmn:TextAnnotation") ? annotationSizePenalty(candidate.rect) : 0,
      dataArtifact ? 0 : associationCrossingCount,
      0,
      artifactExpansion(candidate.rect, extents),
      candidate.sideRank,
      Math.abs(candidate.offset),
      candidate.gap,
      candidate.rect.y,
      candidate.rect.x
    ];
    return {
      candidate,
      lowerBound,
      alignedOwnerCount,
      associationBendCount,
      associationCrossingCount,
      congestionPenalty,
      congestionViolation,
      missesOwnerAlignment,
      participantInteriorPenalty,
      participantVerticalSidePenalty,
      routedReferences
    };
  }).sort((a, b) => compareScores(a.lowerBound, b.lowerBound));
  let best;
  for (const {
    candidate,
    lowerBound,
    alignedOwnerCount,
    associationBendCount,
    associationCrossingCount,
    congestionPenalty,
    congestionViolation,
    missesOwnerAlignment,
    participantInteriorPenalty,
    participantVerticalSidePenalty,
    routedReferences
  } of rankedCandidates) {
    if (best && compareScores(lowerBound, best.score) >= 0) {
      break;
    }
    const candidateBounds = artifactClearanceBounds(
      artifact,
      candidate.rect,
      annotationClearance
    );
    const fitsContainer = artifactFitsContainer(candidateBounds, container, 0);
    const fitsProcessContainer = artifactFitsContainer(
      candidateBounds,
      processContainer,
      0
    );
    const straddlesContainer = container && rectanglesOverlap(candidateBounds, container) && !fitsContainer;
    const straddlesProcessContainer = processContainer && rectanglesOverlap(candidateBounds, processContainer) && !fitsProcessContainer;
    const violatesContainerBoundary = preparedBoundaryContainers.some(({
      rect,
      containsOwner,
      participant,
      headerRect
    }) => {
      if (participant && rectanglesOverlap(candidateBounds, headerRect)) {
        return true;
      }
      if (!rectanglesOverlap(candidateBounds, rect)) {
        return false;
      }
      return !containsOwner || !artifactFitsContainer(candidateBounds, rect, 0);
    });
    const overlapsParticipantHeader2 = container && candidateBounds.y < container.y + container.height && candidateBounds.y + candidateBounds.height > container.y && candidateBounds.x < container.x && candidateBounds.x + candidateBounds.width > container.x - PARTICIPANT_HEADER_WIDTH;
    if (requiresContainment && !fitsContainer || straddlesContainer || straddlesProcessContainer || violatesContainerBoundary || overlapsParticipantHeader2 || obstacleBounds.some((obstacle) => {
      return rectanglesOverlap(candidateBounds, obstacle);
    }) || occupiedBounds.some((occupied2) => {
      return rectanglesOverlap(candidateBounds, occupied2);
    }) || artifactIntersectsRoutes(candidate.rect, routeSegments)) {
      continue;
    }
    const directPathsClear = routedReferences.every(({ owner, points }) => {
      return pathIsClear(
        points,
        obstacles,
        owner,
        artifact,
        []
      );
    });
    if (!directPathsClear) {
      continue;
    }
    const associationRoutes = routedReferences.map(({ points }) => points);
    const associationLength = dataArtifact ? ownerBalancedRouteLength(routedReferences) : associationRoutes.reduce((total, points) => {
      return total + routeLength(points);
    }, 0);
    const nonStraightPenalty = is(artifact, "bpmn:TextAnnotation") ? associationRoutes.reduce((total, points) => {
      return total + (isStraightOrthogonalRoute(points) ? 0 : NON_STRAIGHT_ARTIFACT_ASSOCIATION_PENALTY);
    }, 0) : 0;
    const score = [
      avoidParticipantInterior ? participantInteriorPenalty : 0,
      dataArtifact ? associationCrossingCount : 0,
      congestionViolation,
      missesOwnerAlignment,
      -alignedOwnerCount,
      associationBendCount,
      associationLength + congestionPenalty + nonStraightPenalty + participantInteriorPenalty * participantInteriorPreference + participantVerticalSidePenalty * 4 * VERTICAL_GAP,
      associationLength,
      is(artifact, "bpmn:TextAnnotation") ? annotationSizePenalty(candidate.rect) : 0,
      dataArtifact ? 0 : associationCrossingCount,
      !is(artifact, "bpmn:TextAnnotation") && (container && !fitsContainer || processContainer && !fitsProcessContainer) ? 1 : 0,
      artifactExpansion(candidate.rect, extents),
      candidate.sideRank,
      Math.abs(candidate.offset),
      candidate.gap,
      candidate.rect.y,
      candidate.rect.x
    ];
    if (!best || compareScores(score, best.score) < 0) {
      best = { candidate: candidate.rect, score };
    }
  }
  if (best) {
    return best.candidate;
  }
  throw new LayoutError(
    "ARTIFACT_PLACEMENT_FAILED",
    artifact.id,
    `No collision-free artifact position could be found (${artifact.id}).`
  );
}
function artifactIsAligned(artifact, owner) {
  return artifact.x + artifact.width / 2 === owner.x + owner.width / 2 || artifact.y + artifact.height / 2 === owner.y + owner.height / 2;
}
function ownerBalancedRouteLength(routedReferences) {
  const ownerRoutes = /* @__PURE__ */ new Map();
  for (const { owner, points } of routedReferences) {
    const lengths = ownerRoutes.get(owner) || [];
    lengths.push(routeLength(points));
    ownerRoutes.set(owner, lengths);
  }
  return [...ownerRoutes.values()].reduce((total, lengths) => {
    return total + lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  }, 0);
}
function artifactCongestionPenalty(rect, obstacles) {
  const nearestDistance = obstacles.reduce((nearest, obstacle) => {
    return Math.min(nearest, rectangleDistance(rect, obstacle));
  }, Infinity);
  return Math.max(0, 2 * ROUTING_MARGIN - nearestDistance);
}
function rectangleDistance(a, b) {
  const horizontal = Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0);
  const vertical = Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0);
  return Math.hypot(horizontal, vertical);
}
function ownedArtifactCandidates(artifact, owner, sizes) {
  const candidates = [];
  const preferredSides = is(artifact, "bpmn:DataObjectReference") ? ["below", "right", "left", "above"] : ["above", "left", "right", "below"];
  const offsets = [0];
  for (let distance = ROUTING_MARGIN; distance <= MAX_ARTIFACT_SEARCH_OFFSET; distance += ROUTING_MARGIN) {
    offsets.push(distance, -distance);
  }
  for (const size of sizes) {
    for (let sideRank = 0; sideRank < preferredSides.length; sideRank++) {
      const side = preferredSides[sideRank];
      for (let gap = ROUTING_MARGIN; gap <= MAX_ARTIFACT_GAP_STEPS * ROUTING_MARGIN; gap += ROUTING_MARGIN) {
        for (const offset of offsets) {
          candidates.push({
            rect: artifactBoundsAt(owner, size, side, gap, offset),
            sideRank,
            offset,
            gap
          });
        }
      }
    }
  }
  return candidates;
}
function artifactBoundsAt(owner, size, side, gap, offset) {
  if (side === "above") {
    return bounds(
      owner.x + (owner.width - size.width) / 2 + offset,
      owner.y - gap - size.height,
      size.width,
      size.height
    );
  }
  if (side === "below") {
    return bounds(
      owner.x + (owner.width - size.width) / 2 + offset,
      owner.y + owner.height + gap,
      size.width,
      size.height
    );
  }
  if (side === "left") {
    return bounds(
      owner.x - gap - size.width,
      owner.y + (owner.height - size.height) / 2 + offset,
      size.width,
      size.height
    );
  }
  return bounds(
    owner.x + owner.width + gap,
    owner.y + (owner.height - size.height) / 2 + offset,
    size.width,
    size.height
  );
}
function artifactClearanceBounds(artifact, rect, clearance) {
  if (!clearance || !is(artifact, "bpmn:TextAnnotation")) {
    return rect;
  }
  return bounds(
    rect.x - clearance,
    rect.y - clearance,
    rect.width + 2 * clearance,
    rect.height + 2 * clearance
  );
}
function unownedArtifactCandidates(sizes, extents) {
  const candidates = [];
  for (const size of sizes) {
    for (let offset = 0; offset <= extents.width + size.width; offset += ROUTING_MARGIN) {
      candidates.push({
        rect: bounds(
          extents.minX + offset,
          extents.minY - VERTICAL_GAP - size.height,
          size.width,
          size.height
        ),
        sideRank: 0,
        offset,
        gap: VERTICAL_GAP
      });
    }
  }
  return candidates;
}
function participantExteriorArtifactCandidates(sizes, ownerBounds, boundaryContainers, annotationClearance) {
  if (!ownerBounds) {
    return [];
  }
  const participants = boundaryContainers.filter(({
    containsOwner,
    participant
  }) => {
    return containsOwner && participant;
  });
  return participants.flatMap(({ rect }) => {
    return sizes.flatMap((size) => {
      const x = ownerBounds.x + (ownerBounds.width - size.width) / 2;
      const gap = Math.max(ROUTING_MARGIN, annotationClearance);
      return [
        {
          rect: bounds(
            x,
            rect.y - gap - size.height,
            size.width,
            size.height
          ),
          sideRank: 4,
          offset: 0,
          gap
        },
        {
          rect: bounds(
            x,
            rect.y + rect.height + gap,
            size.width,
            size.height
          ),
          sideRank: 4,
          offset: 0,
          gap
        }
      ];
    });
  });
}
function outerScopeArtifactCandidates(sizes, extents) {
  const candidates = [];
  for (const size of sizes) {
    const horizontalPositions = axisPositions(
      extents.minX,
      extents.maxX - size.width
    );
    const verticalPositions = axisPositions(
      extents.minY,
      extents.maxY - size.height
    );
    for (const x of horizontalPositions) {
      candidates.push({
        rect: bounds(
          x,
          extents.minY - ROUTING_MARGIN - size.height,
          size.width,
          size.height
        ),
        sideRank: 4,
        offset: 0,
        gap: ROUTING_MARGIN
      });
      candidates.push({
        rect: bounds(
          x,
          extents.maxY + ROUTING_MARGIN,
          size.width,
          size.height
        ),
        sideRank: 4,
        offset: 0,
        gap: ROUTING_MARGIN
      });
    }
    for (const y of verticalPositions) {
      candidates.push({
        rect: bounds(
          extents.minX - ROUTING_MARGIN - size.width,
          y,
          size.width,
          size.height
        ),
        sideRank: 4,
        offset: 0,
        gap: ROUTING_MARGIN
      });
      candidates.push({
        rect: bounds(
          extents.maxX + ROUTING_MARGIN,
          y,
          size.width,
          size.height
        ),
        sideRank: 4,
        offset: 0,
        gap: ROUTING_MARGIN
      });
    }
  }
  return candidates;
}
function axisPositions(min, max) {
  if (max <= min) {
    return [Math.round((min + max) / 2)];
  }
  const positions = [];
  for (let position = min; position <= max; position += ROUTING_MARGIN) {
    positions.push(position);
  }
  if (positions.at(-1) !== max) {
    positions.push(max);
  }
  return positions;
}
function artifactFitsContainer(candidate, container, margin = ROUTING_MARGIN) {
  return !container || candidate.x >= container.x + margin && candidate.y >= container.y + margin && candidate.x + candidate.width <= container.x + container.width - margin && candidate.y + candidate.height <= container.y + container.height - margin;
}
function artifactObstacleBounds(rect) {
  return {
    x: rect.x - BOUNDARY_EVENT_ARTIFACT_CLEARANCE,
    y: rect.y - BOUNDARY_EVENT_ARTIFACT_CLEARANCE,
    width: rect.width + 2 * BOUNDARY_EVENT_ARTIFACT_CLEARANCE,
    height: rect.height + 2 * BOUNDARY_EVENT_ARTIFACT_CLEARANCE
  };
}
function artifactIntersectsRoutes(rect, routeSegments) {
  const clearance = {
    x: rect.x - ROUTING_MARGIN / 2,
    y: rect.y - ROUTING_MARGIN / 2,
    width: rect.width + ROUTING_MARGIN,
    height: rect.height + ROUTING_MARGIN
  };
  return routeSegments.some(([start, end]) => {
    return segmentEntersRect(start, end, clearance);
  });
}
function routeCrossings(points, routeSegments) {
  return toSegments(points).reduce((total, [start, end]) => {
    return total + routeSegments.filter(([a, b]) => {
      return segmentsProperlyCross(start, end, a, b);
    }).length;
  }, 0);
}
function artifactExpansion(rect, extents) {
  return Math.max(0, extents.minX - rect.x) + Math.max(0, extents.minY - rect.y) + Math.max(0, rect.x + rect.width - extents.maxX) + Math.max(0, rect.y + rect.height - extents.maxY);
}
function isStraightOrthogonalRoute(points) {
  return points.every(({ x }) => x === points[0].x) || points.every(({ y }) => y === points[0].y);
}
function routeArtifactAssociation(association, owner, ownerBounds, artifact, artifactBounds, connectionIndex, connectionCount, obstacles = [], routes = []) {
  return associationConnection(
    association,
    owner,
    ownerBounds,
    artifact,
    artifactBounds,
    connectionIndex,
    connectionCount,
    obstacles,
    routes.flatMap((route) => toSegments(route.points))
  );
}
function routeMessageFlow(source, target, sourceBounds, targetBounds, collaboration, participantShapes, obstacles, routedConnections, channelOffset) {
  const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
  const targetCenterY = targetBounds.y + targetBounds.height / 2;
  if (sourceCenterY === targetCenterY) {
    return directConnection(sourceBounds, targetBounds);
  }
  const downward = targetCenterY > sourceCenterY;
  const start = point(
    sourceBounds.x + sourceBounds.width / 2,
    downward ? sourceBounds.y + sourceBounds.height : sourceBounds.y
  );
  const end = point(
    targetBounds.x + targetBounds.width / 2,
    downward ? targetBounds.y : targetBounds.y + targetBounds.height
  );
  const sourceParticipant = findEndpointParticipant(source, collaboration);
  const targetParticipant = findEndpointParticipant(target, collaboration);
  const sourceParticipantBounds = participantShapes.get(sourceParticipant);
  const targetParticipantBounds = participantShapes.get(targetParticipant);
  const participantRows = [...new Set(
    [...collaboration.participants || []].map((participant) => participantShapes.get(participant).y).sort((a, b) => a - b)
  )];
  const sourceIndex = participantRows.indexOf(sourceParticipantBounds?.y);
  const targetIndex = participantRows.indexOf(targetParticipantBounds?.y);
  if (!sourceParticipantBounds || !targetParticipantBounds || sourceIndex === -1 || targetIndex === -1) {
    return visibilityRoute(
      start,
      end,
      obstacles,
      source,
      target,
      routedConnections,
      MESSAGE_FLOW_OBSTACLE_INSET,
      true
    ) || directConnection(sourceBounds, targetBounds);
  }
  const sourcePoolEdgeY = downward ? sourceParticipantBounds.y + sourceParticipantBounds.height : sourceParticipantBounds.y;
  const targetPoolEdgeY = downward ? targetParticipantBounds.y : targetParticipantBounds.y + targetParticipantBounds.height;
  const sourceObstacles = obstacles.filter(({ rect }) => centerIsInside(rect, sourceParticipantBounds));
  const targetObstacles = obstacles.filter(({ rect }) => centerIsInside(rect, targetParticipantBounds));
  const sourceIsParticipant = source === sourceParticipant;
  const targetIsParticipant = target === targetParticipant;
  const sourceDockX = findMessageFlowDockX(
    sourceBounds,
    downward,
    true,
    sourceIsParticipant ? 0 : channelOffset,
    obstacles,
    source,
    target,
    routedConnections
  );
  const targetDockX = findMessageFlowDockX(
    targetBounds,
    downward,
    false,
    targetIsParticipant ? 0 : channelOffset,
    obstacles,
    source,
    target,
    routedConnections
  );
  start.x = sourceDockX;
  end.x = targetDockX;
  if (sourceIsParticipant && !targetIsParticipant) {
    start.x = constrainParticipantDockX(targetDockX, sourceParticipantBounds);
  } else if (targetIsParticipant && !sourceIsParticipant) {
    end.x = constrainParticipantDockX(sourceDockX, targetParticipantBounds);
  } else if (sourceIsParticipant && targetIsParticipant) {
    const overlapCenter = (Math.max(sourceParticipantBounds.x, targetParticipantBounds.x) + Math.min(
      sourceParticipantBounds.x + sourceParticipantBounds.width,
      targetParticipantBounds.x + targetParticipantBounds.width
    )) / 2 + channelOffset;
    start.x = overlapCenter;
    end.x = overlapCenter;
  }
  if ((sourceIsParticipant || targetIsParticipant) && start.x === end.x) {
    if (segmentIsClear(start, end, obstacles, source, target, [])) {
      return [start, end];
    }
    const verticalBypass = findMessageFlowVerticalBypass(
      source,
      target,
      sourceBounds,
      targetBounds,
      sourceIsParticipant,
      targetIsParticipant,
      start,
      end,
      obstacles,
      channelOffset
    );
    if (verticalBypass) {
      return verticalBypass;
    }
    const localBypass = visibilityRoute(start, end, obstacles, source, target, []);
    if (localBypass) {
      return localBypass;
    }
  } else if (start.x === end.x && segmentIsClear(start, end, obstacles, source, target, [])) {
    return [start, end];
  }
  if (Math.abs(sourceIndex - targetIndex) === 1) {
    const channelY = Math.round((sourcePoolEdgeY + targetPoolEdgeY) / 2);
    const sourceChannel2 = point(start.x, channelY);
    const targetChannel2 = point(end.x, channelY);
    return cleanPoints([
      ...routeMessageLeg(start, sourceChannel2, sourceObstacles, source, target, routedConnections),
      targetChannel2,
      ...routeMessageLeg(targetChannel2, end, targetObstacles, source, target, routedConnections).slice(1)
    ]);
  }
  const direction = downward ? 1 : -1;
  const sourceChannelY = sourcePoolEdgeY + direction * ROUTING_MARGIN;
  const targetChannelY = targetPoolEdgeY - direction * ROUTING_MARGIN;
  const sourceChannel = point(start.x, sourceChannelY);
  const targetChannel = point(end.x, targetChannelY);
  const participantBounds = [...participantShapes.values()];
  const largeCollaboration = (collaboration.participants || []).length > MAX_EXHAUSTIVE_PARTICIPANT_COUNT;
  const firstRowY = Math.min(sourceParticipantBounds.y, targetParticipantBounds.y);
  const lastRowY = Math.max(sourceParticipantBounds.y, targetParticipantBounds.y);
  const interveningParticipants = participantBounds.filter((rect) => {
    return rect.y > firstRowY && rect.y < lastRowY;
  });
  const rightExteriorX = Math.max(
    ...participantBounds.map((rect) => rect.x + rect.width)
  ) + ROUTING_MARGIN;
  const channelXs = largeCollaboration ? [
    start.x,
    end.x,
    ...interveningParticipants.flatMap((rect) => [
      rect.x - ROUTING_MARGIN,
      rect.x + rect.width + ROUTING_MARGIN
    ]),
    Math.min(...participantBounds.map((rect) => rect.x)) - ROUTING_MARGIN,
    rightExteriorX
  ] : [rightExteriorX];
  const channelX = [...new Set(channelXs)].filter((candidateX) => {
    return interveningParticipants.every((rect) => {
      return candidateX <= rect.x - ROUTING_MARGIN || candidateX >= rect.x + rect.width + ROUTING_MARGIN;
    });
  }).sort((a, b) => {
    const aDistance = Math.abs(start.x - a) + Math.abs(end.x - a);
    const bDistance = Math.abs(start.x - b) + Math.abs(end.x - b);
    return aDistance - bDistance;
  })[0];
  return cleanPoints([
    ...routeMessageLeg(
      start,
      sourceChannel,
      sourceObstacles,
      source,
      target,
      routedConnections
    ),
    point(channelX, sourceChannelY),
    point(channelX, targetChannelY),
    targetChannel,
    ...routeMessageLeg(
      targetChannel,
      end,
      targetObstacles,
      source,
      target,
      routedConnections
    ).slice(1)
  ]);
}
function alignParticipantsHorizontally(collaboration, participantShapes, endpointShapes, connectionRoutes, channelOffsets, anchorPositionedParticipants, expandableParticipants) {
  const participants = collaboration.participants || [];
  const processParticipants = participants.filter((participant) => participant.processRef);
  const anchorParticipant = processParticipants.reduce((largest, participant) => {
    if (!largest) {
      return participant;
    }
    const rect = participantShapes.get(participant);
    const largestRect = participantShapes.get(largest);
    return rect.width * rect.height > largestRect.width * largestRect.height ? participant : largest;
  }, null);
  const movableParticipants = processParticipants.filter((participant) => {
    return participant !== anchorParticipant;
  });
  const initialPositions = new Map(participants.map((participant) => {
    return [participant, participantShapes.get(participant).x];
  }));
  const positions = new Map(initialPositions);
  const scoreCache = /* @__PURE__ */ new Map();
  const scorePositions = (candidatePositions) => {
    const key = participants.map((participant) => candidatePositions.get(participant)).join(":");
    if (!scoreCache.has(key)) {
      scoreCache.set(key, horizontalAlignmentScore(
        candidatePositions,
        initialPositions,
        collaboration,
        participantShapes,
        endpointShapes,
        connectionRoutes,
        channelOffsets,
        anchorPositionedParticipants,
        expandableParticipants
      ));
    }
    return scoreCache.get(key);
  };
  const endpointRecords = (collaboration.messageFlows || []).map((messageFlow) => {
    const source = resolveMessageFlowEndpoint(messageFlow.sourceRef, endpointShapes);
    const target = resolveMessageFlowEndpoint(messageFlow.targetRef, endpointShapes);
    const sourceParticipant = findEndpointParticipant(source, collaboration);
    const targetParticipant = findEndpointParticipant(target, collaboration);
    return {
      messageFlow,
      source,
      target,
      sourceParticipant,
      targetParticipant
    };
  }).filter((record) => {
    return record.source && record.target && record.sourceParticipant && record.targetParticipant && record.sourceParticipant !== record.targetParticipant && (movableParticipants.includes(record.sourceParticipant) || movableParticipants.includes(record.targetParticipant));
  });
  if (!endpointRecords.length) {
    return positions;
  }
  const localIntervals = /* @__PURE__ */ new Map();
  for (const { source, target, sourceParticipant, targetParticipant } of endpointRecords) {
    localIntervals.set(
      source,
      getLocalHorizontalInterval(
        source,
        sourceParticipant,
        endpointShapes,
        participantShapes
      )
    );
    localIntervals.set(
      target,
      getLocalHorizontalInterval(
        target,
        targetParticipant,
        endpointShapes,
        participantShapes
      )
    );
  }
  let currentScore = scorePositions(positions);
  let changed;
  do {
    changed = false;
    for (const participant of movableParticipants) {
      const candidates = [positions.get(participant)];
      for (const record of endpointRecords) {
        if (record.sourceParticipant === participant) {
          for (const sourceOffset of localIntervals.get(record.source)) {
            for (const targetOffset of localIntervals.get(record.target)) {
              candidates.push(Math.round(
                positions.get(record.targetParticipant) + targetOffset - sourceOffset
              ));
            }
          }
        } else if (record.targetParticipant === participant) {
          for (const sourceOffset of localIntervals.get(record.source)) {
            for (const targetOffset of localIntervals.get(record.target)) {
              candidates.push(Math.round(
                positions.get(record.sourceParticipant) + sourceOffset - targetOffset
              ));
            }
          }
        }
      }
      let bestPosition = positions.get(participant);
      let bestScore = currentScore;
      for (const candidate of [...new Set(candidates)]) {
        if (candidate === positions.get(participant)) {
          continue;
        }
        const candidatePositions = new Map(positions);
        candidatePositions.set(participant, candidate);
        const candidateScore = scorePositions(candidatePositions);
        if (compareScores(candidateScore, bestScore) < 0) {
          bestPosition = candidate;
          bestScore = candidateScore;
        }
      }
      if (bestPosition !== positions.get(participant)) {
        positions.set(participant, bestPosition);
        currentScore = bestScore;
        changed = true;
      }
    }
  } while (changed);
  return positions;
}
function alignParticipantComponentsLeft(collaboration, participantShapes) {
  const participants = collaboration.participants || [];
  if (participants.length < 2) {
    return /* @__PURE__ */ new Map();
  }
  const neighbors = new Map(participants.map((participant) => {
    return [participant, /* @__PURE__ */ new Set()];
  }));
  for (const messageFlow of collaboration.messageFlows || []) {
    const source = findEndpointParticipant(messageFlow.sourceRef, collaboration);
    const target = findEndpointParticipant(messageFlow.targetRef, collaboration);
    if (!neighbors.has(source) || !neighbors.has(target) || source === target) {
      continue;
    }
    neighbors.get(source).add(target);
    neighbors.get(target).add(source);
  }
  const targetX = Math.min(...participants.map((participant) => {
    return participantShapes.get(participant).x;
  }));
  const offsets = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  for (const participant of participants) {
    if (visited.has(participant)) {
      continue;
    }
    const component = [];
    const queue = [participant];
    visited.add(participant);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of neighbors.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    const componentX = Math.min(...component.map((member) => {
      return participantShapes.get(member).x;
    }));
    const dx = targetX - componentX;
    for (const member of component) {
      offsets.set(member, dx);
    }
  }
  return offsets;
}
function getLocalHorizontalInterval(element, participant, endpointShapes, participantShapes) {
  const rect = endpointShapes.get(element);
  const participantBounds = participantShapes.get(participant);
  if (is(element, "bpmn:Participant")) {
    const inset2 = ROUTING_MARGIN + MESSAGE_FLOW_SIDE_OFFSET;
    return [inset2, participantBounds.width - inset2];
  }
  return [rect.x + rect.width / 2 - participantBounds.x];
}
function horizontalAlignmentScore(positions, initialPositions, collaboration, participantShapes, endpointShapes, connectionRoutes, channelOffsets, anchorPositionedParticipants, expandableParticipants) {
  const translatedShapes = new Map([...endpointShapes].map(([element, rect]) => {
    const participant = findEndpointParticipant(element, collaboration);
    const dx = positions.has(participant) ? positions.get(participant) - initialPositions.get(participant) : 0;
    return [
      element,
      bounds(rect.x + dx, rect.y, rect.width, rect.height)
    ];
  }));
  const translatedParticipants = new Map((collaboration.participants || []).map((participant) => {
    return [participant, translatedShapes.get(participant)];
  }));
  sizeAndPositionParticipantsFromMessageAnchors(
    collaboration,
    translatedParticipants,
    translatedShapes,
    channelOffsets,
    anchorPositionedParticipants,
    expandableParticipants
  );
  const obstacles = getMessageObstacles(translatedShapes);
  const routes = routeMessageFlows(
    collaboration,
    translatedParticipants,
    translatedShapes,
    obstacles,
    channelOffsets
  );
  const bendCount = [...routes.values()].filter((points) => points.length > 2).length;
  const routeCosts = [...routes.values()].map((points) => {
    const bendCost = points.length > 2 ? MESSAGE_FLOW_BEND_PENALTY : 0;
    return routeLength(points) + bendCost;
  });
  const routingCost = routeCosts.reduce((total, cost) => total + cost, 0);
  const translatedConnections = connectionRoutes.map(([element, points]) => {
    const participant = findEndpointParticipant(element, collaboration);
    const dx = positions.has(participant) ? positions.get(participant) - initialPositions.get(participant) : 0;
    return points.map((routePoint) => point(routePoint.x + dx, routePoint.y));
  });
  const crossingCount = countRouteCrossings([
    ...translatedConnections,
    ...routes.values()
  ]);
  const displacement = [...positions].reduce((total, [participant, x]) => {
    return total + Math.abs(x - initialPositions.get(participant));
  }, 0);
  const routeQuality = (collaboration.participants || []).length > MAX_EXHAUSTIVE_PARTICIPANT_COUNT ? [bendCount, crossingCount] : [crossingCount, bendCount];
  return [
    ...routeQuality,
    Math.max(0, ...routeCosts),
    routingCost,
    displacement
  ];
}
function countRouteCrossings(routes) {
  const segments = routes.map(toSegments);
  let crossings = 0;
  for (let first = 0; first < segments.length; first++) {
    for (let second = first + 1; second < segments.length; second++) {
      for (const [a, b] of segments[first]) {
        crossings += segments[second].filter(([c, d]) => {
          return segmentsProperlyCross(a, b, c, d);
        }).length;
      }
    }
  }
  return crossings;
}
function getMessageObstacles(shapes) {
  return [...shapes].filter(([element]) => {
    return !is(element, "bpmn:Lane") && !is(element, "bpmn:Participant") && !is(element, "bpmn:SubProcess") && !isArtifact(element);
  }).map(([element, rect]) => ({ element, rect }));
}
function routeMessageFlows(collaboration, participantShapes, endpointShapes, obstacles, channelOffsets) {
  const routes = /* @__PURE__ */ new Map();
  const routedConnections = [];
  for (const messageFlow of collaboration.messageFlows || []) {
    const source = resolveMessageFlowEndpoint(messageFlow.sourceRef, endpointShapes);
    const target = resolveMessageFlowEndpoint(messageFlow.targetRef, endpointShapes);
    const sourceBounds = endpointShapes.get(source);
    const targetBounds = endpointShapes.get(target);
    if (!sourceBounds || !targetBounds) {
      continue;
    }
    const points = routeMessageFlow(
      source,
      target,
      sourceBounds,
      targetBounds,
      collaboration,
      participantShapes,
      obstacles,
      routedConnections,
      channelOffsets.get(messageFlow) || 0
    );
    routes.set(messageFlow, points);
    routedConnections.push({ flow: messageFlow, points });
  }
  return routes;
}
function findMessageFlowDockX(endpointBounds, downward, source, offset, obstacles, sourceElement, targetElement, routedConnections) {
  const inset2 = Math.min(ROUTING_MARGIN, endpointBounds.width / 2);
  const minX = endpointBounds.x + inset2;
  const maxX = endpointBounds.x + endpointBounds.width - inset2;
  const centerX = endpointBounds.x + endpointBounds.width / 2;
  const preferredX = Math.max(minX, Math.min(centerX + offset, maxX));
  const candidates = [
    preferredX,
    centerX,
    minX,
    maxX
  ].filter((candidate, index, values) => values.indexOf(candidate) === index);
  const dockY = source === downward ? endpointBounds.y + endpointBounds.height : endpointBounds.y;
  const outsideY = dockY + (source === downward ? ROUTING_MARGIN : -ROUTING_MARGIN);
  return candidates.find((candidate) => {
    return segmentIsClear(
      point(candidate, dockY),
      point(candidate, outsideY),
      obstacles,
      sourceElement,
      targetElement,
      routedConnections,
      MESSAGE_FLOW_OBSTACLE_INSET,
      true
    );
  }) || preferredX;
}
function findMessageFlowVerticalBypass(source, target, sourceBounds, targetBounds, sourceIsParticipant, targetIsParticipant, start, end, obstacles, channelOffset) {
  if (sourceIsParticipant === targetIsParticipant) {
    return null;
  }
  const nodeBounds = sourceIsParticipant ? targetBounds : sourceBounds;
  const outgoing = !sourceIsParticipant;
  const participantY = sourceIsParticipant ? start.y : end.y;
  const participantAbove = participantY < nodeBounds.y + nodeBounds.height / 2;
  const dockY = participantAbove ? nodeBounds.y : nodeBounds.y + nodeBounds.height;
  const leadY = dockY + (participantAbove ? -ROUTING_MARGIN : ROUTING_MARGIN);
  const preferredSide = channelOffset || (outgoing ? MESSAGE_FLOW_SIDE_OFFSET : -MESSAGE_FLOW_SIDE_OFFSET);
  const sides = [
    {
      offset: MESSAGE_FLOW_SIDE_OFFSET,
      channelX: nodeBounds.x + nodeBounds.width + ROUTING_MARGIN
    },
    {
      offset: -MESSAGE_FLOW_SIDE_OFFSET,
      channelX: nodeBounds.x - ROUTING_MARGIN
    }
  ].sort((a, b) => {
    return Math.abs(a.offset - preferredSide) - Math.abs(b.offset - preferredSide);
  });
  for (const { channelX } of sides) {
    const dockX = nodeBounds.x + nodeBounds.width / 2 + channelOffset;
    const dock = point(dockX, dockY);
    const lead = point(dockX, leadY);
    const channel = point(channelX, leadY);
    const participantDock = point(channelX, sourceIsParticipant ? start.y : end.y);
    const candidate = sourceIsParticipant ? [participantDock, channel, lead, dock] : [dock, lead, channel, participantDock];
    if (pathIsClear(candidate, obstacles, source, target, [])) {
      return candidate;
    }
  }
  return null;
}
function centerIsInside(rect, container) {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  return x >= container.x && x <= container.x + container.width && y >= container.y && y <= container.y + container.height;
}
function routeMessageLeg(start, end, obstacles, source, target, routedConnections) {
  if (segmentIsClear(
    start,
    end,
    obstacles,
    source,
    target,
    routedConnections,
    MESSAGE_FLOW_OBSTACLE_INSET,
    true
  )) {
    return [start, end];
  }
  return visibilityRoute(
    start,
    end,
    obstacles,
    source,
    target,
    routedConnections,
    MESSAGE_FLOW_OBSTACLE_INSET,
    true
  ) || visibilityRoute(
    start,
    end,
    obstacles,
    source,
    target,
    [],
    MESSAGE_FLOW_OBSTACLE_INSET,
    true
  ) || [start, end];
}
function sizeAndPositionParticipantsFromMessageAnchors(collaboration, participantShapes, endpointShapes, channelOffsets, anchorPositionedParticipants, expandableParticipants) {
  const participants = collaboration.participants || [];
  const anchorPositioned = participants.filter((participant) => {
    return anchorPositionedParticipants.has(participant);
  });
  const anchors = new Map(anchorPositioned.map((participant) => [participant, []]));
  const participantConnections = [];
  for (const messageFlow of collaboration.messageFlows || []) {
    const source = resolveMessageFlowEndpoint(messageFlow.sourceRef, endpointShapes);
    const target = resolveMessageFlowEndpoint(messageFlow.targetRef, endpointShapes);
    const offset = channelOffsets.get(messageFlow) || 0;
    if (anchors.has(source) && !is(target, "bpmn:Participant")) {
      const targetBounds = endpointShapes.get(target);
      anchors.get(source).push(targetBounds.x + targetBounds.width / 2 + offset);
    }
    if (anchors.has(target) && !is(source, "bpmn:Participant")) {
      const sourceBounds = endpointShapes.get(source);
      anchors.get(target).push(sourceBounds.x + sourceBounds.width / 2 + offset);
    }
    if (is(source, "bpmn:Participant") && is(target, "bpmn:Participant") && (anchors.has(source) || anchors.has(target))) {
      participantConnections.push([source, target]);
    }
  }
  const positioned = new Set(participants.filter((participant) => {
    return !anchorPositionedParticipants.has(participant);
  }));
  for (const participant of anchorPositioned) {
    const participantAnchors = anchors.get(participant);
    if (!participantAnchors.length) {
      continue;
    }
    const participantBounds = participantShapes.get(participant);
    const anchorsFitCurrentBounds = participantAnchors.every((anchor) => {
      return anchor >= participantBounds.x + PARTICIPANT_HEADER_WIDTH && anchor <= participantBounds.x + participantBounds.width - PARTICIPANT_HEADER_WIDTH;
    });
    if (participant.processRef && anchorsFitCurrentBounds) {
      positioned.add(participant);
      continue;
    }
    const min = Math.min(...participantAnchors);
    const max = Math.max(...participantAnchors);
    const width = Math.max(
      participantBounds.width,
      expandableParticipants.has(participant) ? max - min + 2 * PARTICIPANT_HEADER_WIDTH : 0
    );
    const center = (min + max) / 2;
    participantBounds.x = Math.round(center - width / 2);
    participantBounds.width = Math.round(width);
    positioned.add(participant);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const participant of anchorPositioned) {
      if (positioned.has(participant)) {
        continue;
      }
      const neighbors = participantConnections.flatMap(([source, target]) => {
        if (source === participant && positioned.has(target)) {
          return [target];
        }
        if (target === participant && positioned.has(source)) {
          return [source];
        }
        return [];
      });
      if (!neighbors.length) {
        continue;
      }
      const center = neighbors.reduce((sum, neighbor) => {
        const neighborBounds = participantShapes.get(neighbor);
        return sum + neighborBounds.x + neighborBounds.width / 2;
      }, 0) / neighbors.length;
      const participantBounds = participantShapes.get(participant);
      participantBounds.x = Math.round(center - participantBounds.width / 2);
      positioned.add(participant);
      changed = true;
    }
  }
  for (const [source, target] of participantConnections) {
    ensureParticipantDockOverlap(
      participantShapes.get(source),
      participantShapes.get(target),
      expandableParticipants.has(source),
      expandableParticipants.has(target)
    );
  }
}
function includeResizableParticipantMessageDocks(collaboration, participantShapes, edges, expandableParticipants) {
  let changed = false;
  for (const messageFlow of collaboration.messageFlows || []) {
    const points = edges.get(messageFlow);
    if (!points?.length) {
      continue;
    }
    for (const [endpoint, dock] of [
      [messageFlow.sourceRef, points[0]],
      [messageFlow.targetRef, points.at(-1)]
    ]) {
      if (!is(endpoint, "bpmn:Participant") || !expandableParticipants.has(endpoint)) {
        continue;
      }
      const participantBounds = participantShapes.get(endpoint);
      const previousX = participantBounds.x;
      const previousWidth = participantBounds.width;
      includeHorizontalRange(
        participantBounds,
        dock.x - PARTICIPANT_HEADER_WIDTH,
        dock.x + PARTICIPANT_HEADER_WIDTH
      );
      changed = changed || participantBounds.x !== previousX || participantBounds.width !== previousWidth;
    }
  }
  return changed;
}
function constrainParticipantDockX(x, participantBounds) {
  return Math.max(
    participantBounds.x + PARTICIPANT_HEADER_WIDTH,
    Math.min(
      x,
      participantBounds.x + participantBounds.width - PARTICIPANT_HEADER_WIDTH
    )
  );
}
function ensureParticipantDockOverlap(source, target, sourceResizable = true, targetResizable = true) {
  const sourceRight = source.x + source.width;
  const targetRight = target.x + target.width;
  const overlapStart = Math.max(source.x, target.x);
  const overlapEnd = Math.min(sourceRight, targetRight);
  if (overlapEnd - overlapStart >= 2 * ROUTING_MARGIN) {
    return;
  }
  if (sourceResizable !== targetResizable) {
    const mutable = sourceResizable ? source : target;
    const fixed = sourceResizable ? target : source;
    const fixedRight = fixed.x + fixed.width;
    const mutableCenter = mutable.x + mutable.width / 2;
    const channelX2 = Math.max(
      fixed.x + ROUTING_MARGIN,
      Math.min(mutableCenter, fixedRight - ROUTING_MARGIN)
    );
    includeHorizontalRange(
      mutable,
      channelX2 - ROUTING_MARGIN,
      channelX2 + ROUTING_MARGIN
    );
    return;
  }
  const channelX = Math.round((overlapStart + overlapEnd) / 2);
  const dockStart = channelX - ROUTING_MARGIN;
  const dockEnd = channelX + ROUTING_MARGIN;
  if (sourceResizable) {
    includeHorizontalRange(source, dockStart, dockEnd);
  }
  if (targetResizable) {
    includeHorizontalRange(target, dockStart, dockEnd);
  }
}
function includeHorizontalRange(bounds2, min, max) {
  const right = bounds2.x + bounds2.width;
  bounds2.x = Math.min(bounds2.x, min);
  bounds2.width = Math.max(right, max) - bounds2.x;
}
function assignMessageFlowChannelOffsets(collaboration, shapes) {
  const groups = /* @__PURE__ */ new Map();
  const offsets = /* @__PURE__ */ new Map();
  for (const messageFlow of collaboration.messageFlows || []) {
    const source = resolveMessageFlowEndpoint(messageFlow.sourceRef, shapes);
    const target = resolveMessageFlowEndpoint(messageFlow.targetRef, shapes);
    const sourceId = source.id;
    const targetId = target.id;
    const key = [sourceId, targetId].sort().join(":");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ messageFlow, source, target });
  }
  for (const flows of groups.values()) {
    const first = flows[0];
    const forward = flows.filter((flow) => {
      return flow.source === first.source && flow.target === first.target;
    });
    const reverse = flows.filter((flow) => {
      return flow.source === first.target && flow.target === first.source;
    });
    if (!forward.length || !reverse.length) {
      continue;
    }
    const node = is(first.source, "bpmn:Participant") ? first.target : first.source;
    const nodeBounds = shapes.get(node);
    const spacing = nodeBounds && !is(node, "bpmn:Participant") ? Math.min(
      MESSAGE_FLOW_CHANNEL_SPACING,
      Math.floor(nodeBounds.width / MESSAGE_FLOW_CHANNEL_WIDTH_DIVISOR)
    ) : MESSAGE_FLOW_CHANNEL_SPACING;
    const firstDirection = is(first.source, "bpmn:Participant") && !is(first.target, "bpmn:Participant") ? 1 : -1;
    forward.forEach((flow, index) => {
      offsets.set(flow.messageFlow, firstDirection * spacing * (index + 1));
    });
    reverse.forEach((flow, index) => {
      offsets.set(flow.messageFlow, -firstDirection * spacing * (index + 1));
    });
  }
  return offsets;
}
function orderParticipantsByMessageFlow(collaboration, participantShapes, endpointShapes) {
  const participants = collaboration.participants || [];
  if (participants.length < 2) {
    return participants;
  }
  const scoreOrder = createMessageFlowOrderScorer(
    participants,
    collaboration,
    participantShapes,
    endpointShapes
  );
  if (participants.length <= MAX_EXHAUSTIVE_PARTICIPANT_COUNT) {
    let bestOrder = participants;
    let bestScore = null;
    const permute = (prefix2, remaining) => {
      if (!remaining.length) {
        const score = scoreOrder(prefix2);
        if (!bestScore || compareScores(score, bestScore) < 0) {
          bestOrder = [...prefix2];
          bestScore = score;
        }
        return;
      }
      for (let index = 0; index < remaining.length; index++) {
        permute(
          [...prefix2, remaining[index]],
          [...remaining.slice(0, index), ...remaining.slice(index + 1)]
        );
      }
    };
    permute([], participants);
    return bestOrder;
  }
  let ordered = [participants[0]];
  for (const participant of participants.slice(1)) {
    let bestOrder;
    let bestScore = null;
    for (let index = 0; index <= ordered.length; index++) {
      const candidate = [
        ...ordered.slice(0, index),
        participant,
        ...ordered.slice(index)
      ];
      const score = scoreOrder(candidate);
      if (!bestScore || compareScores(score, bestScore) < 0) {
        bestOrder = candidate;
        bestScore = score;
      }
    }
    ordered = bestOrder;
  }
  let improved;
  do {
    improved = false;
    for (const participant of participants) {
      const currentIndex = ordered.indexOf(participant);
      const remaining = ordered.filter((candidate) => candidate !== participant);
      let bestOrder = ordered;
      let bestScore = scoreOrder(ordered);
      for (let index = 0; index <= remaining.length; index++) {
        if (index === currentIndex) {
          continue;
        }
        const candidate = [
          ...remaining.slice(0, index),
          participant,
          ...remaining.slice(index)
        ];
        const score = scoreOrder(candidate);
        if (compareScores(score, bestScore) < 0) {
          bestOrder = candidate;
          bestScore = score;
        }
      }
      if (bestOrder !== ordered) {
        ordered = bestOrder;
        improved = true;
      }
    }
  } while (improved);
  return ordered;
}
function createMessageFlowOrderScorer(participants, collaboration, participantShapes, endpointShapes) {
  const context = createMessageFlowOrderContext(collaboration, endpointShapes);
  if (participants.length <= MAX_EXHAUSTIVE_PARTICIPANT_COUNT) {
    return (order) => messageFlowOrderScore(order, participantShapes, context);
  }
  const participantIndexes = new Map(
    participants.map((participant, index) => [participant, index])
  );
  const scores = /* @__PURE__ */ new Map();
  return (order) => {
    const key = order.map((participant) => participantIndexes.get(participant)).join(":");
    if (!scores.has(key)) {
      scores.set(key, messageFlowOrderScore(order, participantShapes, context));
    }
    return scores.get(key);
  };
}
function createMessageFlowOrderContext(collaboration, endpointShapes) {
  const participantsByProcess = /* @__PURE__ */ new Map();
  for (const participant of collaboration.participants || []) {
    if (!participantsByProcess.has(participant.processRef)) {
      participantsByProcess.set(participant.processRef, participant);
    }
  }
  const messageFlows = (collaboration.messageFlows || []).map((messageFlow) => {
    const source = resolveMessageFlowEndpoint(messageFlow.sourceRef, endpointShapes);
    const target = resolveMessageFlowEndpoint(messageFlow.targetRef, endpointShapes);
    return {
      source,
      target,
      sourceBounds: endpointShapes.get(source),
      targetBounds: endpointShapes.get(target),
      sourceParticipant: findEndpointParticipantCached(source, participantsByProcess),
      targetParticipant: findEndpointParticipantCached(target, participantsByProcess)
    };
  });
  const obstacles = [...endpointShapes.entries()].filter(([element]) => {
    return !is(element, "bpmn:Participant") && !is(element, "bpmn:Lane") && !is(element, "bpmn:SubProcess");
  }).map(([element, rect]) => ({
    element,
    rect,
    participant: findEndpointParticipantCached(element, participantsByProcess),
    insetX: rect.x + MESSAGE_FLOW_OBSTACLE_INSET,
    insetWidth: rect.width - 2 * MESSAGE_FLOW_OBSTACLE_INSET,
    insetHeight: rect.height - 2 * MESSAGE_FLOW_OBSTACLE_INSET
  }));
  return {
    messageFlows,
    obstacles,
    useWeightedSeparation: (collaboration.participants || []).filter((participant) => participant.processRef).length > 1,
    prioritizeCollapsedAdjacency: messageFlows.some(({
      sourceParticipant,
      targetParticipant
    }) => {
      return sourceParticipant && targetParticipant && !sourceParticipant.processRef && !targetParticipant.processRef;
    })
  };
}
function messageFlowOrderScore(order, participantShapes, context) {
  const positions = /* @__PURE__ */ new Map();
  const orderIndex = new Map(order.map((participant, index) => [participant, index]));
  let y = 0;
  for (const participant of order) {
    positions.set(participant, y);
    y += participantShapes.get(participant).height + VERTICAL_GAP;
  }
  const geometryScore = context.messageFlows.reduce((total, messageFlow) => {
    const {
      source,
      target,
      sourceParticipant,
      targetParticipant
    } = messageFlow;
    if (!source || !target || !positions.has(sourceParticipant) || !positions.has(targetParticipant)) {
      return total;
    }
    const sourceCenter = getOrderedEndpointCenterY(
      sourceParticipant,
      positions,
      messageFlow.sourceBounds
    );
    const targetCenter = getOrderedEndpointCenterY(
      targetParticipant,
      positions,
      messageFlow.targetBounds
    );
    const downward = targetCenter > sourceCenter;
    const sourceY = getOrderedEndpointDockY(
      sourceParticipant,
      downward,
      true,
      positions,
      messageFlow.sourceBounds
    );
    const targetY = getOrderedEndpointDockY(
      targetParticipant,
      downward,
      false,
      positions,
      messageFlow.targetBounds
    );
    const bendPenalty = orderedMessageFlowNeedsBend(
      messageFlow,
      sourceY,
      targetY,
      positions,
      context.obstacles
    ) ? MESSAGE_FLOW_BEND_PENALTY : 0;
    return total + bendPenalty + Math.abs(targetY - sourceY);
  }, 0);
  let separationPenalty = 0;
  const participantPairs = /* @__PURE__ */ new Set();
  for (const {
    sourceParticipant: source,
    targetParticipant: target
  } of context.messageFlows) {
    if (!orderIndex.has(source) || !orderIndex.has(target) || source === target) {
      continue;
    }
    const sourceIndex = orderIndex.get(source);
    const targetIndex = orderIndex.get(target);
    if (context.useWeightedSeparation) {
      const first = sourceIndex < targetIndex ? source : target;
      const last = sourceIndex < targetIndex ? target : source;
      if (Math.abs(sourceIndex - targetIndex) > 1) {
        separationPenalty += positions.get(last) - positions.get(first) - participantShapes.get(first).height - VERTICAL_GAP;
      }
    } else if (context.prioritizeCollapsedAdjacency) {
      const pair = sourceIndex < targetIndex ? `${source.id}:${target.id}` : `${target.id}:${source.id}`;
      if (!participantPairs.has(pair)) {
        participantPairs.add(pair);
        separationPenalty += Math.max(0, Math.abs(sourceIndex - targetIndex) - 1);
      }
    }
  }
  if (!context.useWeightedSeparation) {
    return context.prioritizeCollapsedAdjacency ? [separationPenalty, geometryScore] : [geometryScore];
  }
  return [
    geometryScore + separationPenalty,
    geometryScore,
    separationPenalty
  ];
}
function getOrderedEndpointCenterY(participant, positions, endpointBounds) {
  return positions.get(participant) + endpointBounds.y + endpointBounds.height / 2;
}
function getOrderedEndpointDockY(participant, downward, source, positions, endpointBounds) {
  const top = positions.get(participant) + endpointBounds.y;
  const dockAtBottom = source ? downward : !downward;
  return dockAtBottom ? top + endpointBounds.height : top;
}
function orderedMessageFlowNeedsBend(messageFlow, sourceY, targetY, positions, obstacles) {
  const {
    source,
    target,
    sourceParticipant,
    targetParticipant,
    sourceBounds,
    targetBounds
  } = messageFlow;
  const sourceIsParticipant = source === sourceParticipant;
  const targetIsParticipant = target === targetParticipant;
  const sourceX = sourceBounds.x + sourceBounds.width / 2;
  const targetX = targetBounds.x + targetBounds.width / 2;
  const straightX = sourceIsParticipant && !targetIsParticipant ? targetX : targetIsParticipant && !sourceIsParticipant ? sourceX : sourceIsParticipant && targetIsParticipant ? sourceX : sourceX === targetX ? sourceX : null;
  if (straightX === null) {
    return true;
  }
  const start = point(straightX, sourceY);
  const end = point(straightX, targetY);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  for (const {
    element,
    participant,
    insetX,
    insetWidth,
    insetHeight,
    rect
  } of obstacles) {
    if (element === source || element === target) {
      continue;
    }
    if (!positions.has(participant)) {
      continue;
    }
    const obstacle = bounds(
      insetX,
      rect.y + positions.get(participant) + MESSAGE_FLOW_OBSTACLE_INSET,
      insetWidth,
      insetHeight
    );
    const verticallyDisjoint = minY === maxY ? minY < obstacle.y || minY > obstacle.y + obstacle.height : maxY <= obstacle.y || minY >= obstacle.y + obstacle.height;
    if (start.x < obstacle.x || start.x > obstacle.x + obstacle.width || verticallyDisjoint) {
      continue;
    }
    if (segmentEntersRect(start, end, obstacle)) {
      return true;
    }
  }
  return false;
}
function findEndpointParticipant(endpoint, collaboration) {
  if (is(endpoint, "bpmn:Participant")) {
    return endpoint;
  }
  const process = findEndpointProcess(endpoint);
  return (collaboration.participants || []).find((participant) => participant.processRef === process);
}
function findEndpointParticipantCached(endpoint, participantsByProcess) {
  if (is(endpoint, "bpmn:Participant")) {
    return endpoint;
  }
  return participantsByProcess.get(findEndpointProcess(endpoint));
}
function findEndpointProcess(endpoint) {
  let parent = endpoint?.$parent;
  while (parent && !is(parent, "bpmn:Process")) {
    parent = parent.$parent;
  }
  return parent;
}
function resolveMessageFlowEndpoint(endpoint, shapes) {
  let visibleEndpoint = endpoint;
  while (visibleEndpoint && !shapes.has(visibleEndpoint)) {
    visibleEndpoint = visibleEndpoint.$parent;
  }
  return visibleEndpoint;
}
function layoutExternalLabels(factory, planeElements) {
  const shapes = planeElements.filter((element) => element.$instanceOf("bpmndi:BPMNShape") && element.bounds).map((di, index) => ({
    di,
    element: di.bpmnElement,
    rect: di.bounds,
    index,
    isContainer: isContainer(di),
    titleBounds: expandedSubProcessTitleBounds(
      di.bpmnElement,
      di.bounds,
      di.isExpanded === true
    )
  }));
  const edges = planeElements.filter((element) => element.$instanceOf("bpmndi:BPMNEdge") && element.waypoint?.length > 1).map((di, index) => ({
    di,
    element: di.bpmnElement,
    points: di.waypoint,
    index
  }));
  const edgeSegments = flattenEdgeSegments(edges);
  const shapeByElement = new Map(shapes.map((shape) => [shape.element, shape]));
  const labels = [
    ...shapes.map((shape) => labelRecord(shape, shape.index)),
    ...edges.map((edge) => labelRecord(edge, shapes.length + edge.index))
  ].filter(Boolean);
  const occupied = [];
  const preferredByLabel = new Map(labels.map((label) => {
    return [label, preferredCandidates(label, shapeByElement, edges)];
  }));
  const staticCandidateCountByLabel = new Map(labels.map((label) => {
    const count = preferredByLabel.get(label).filter((candidate) => candidateIsClear(candidate, label, shapes, edgeSegments, [])).length;
    return [label, count];
  }));
  labels.sort((a, b) => {
    return staticCandidateCountByLabel.get(a) - staticCandidateCountByLabel.get(b) || b.size.width * b.size.height - a.size.width * a.size.height || a.index - b.index;
  });
  for (const label of labels) {
    const preferred = preferredByLabel.get(label);
    const defaultCandidate = preferred[0];
    const candidate = preferred.find((rect) => {
      return candidateIsClear(rect, label, shapes, edgeSegments, occupied);
    }) || freeCandidate(label, defaultCandidate, shapes, edgeSegments, occupied);
    if (!candidate) {
      throw new LayoutError(
        "LABEL_PLACEMENT_FAILED",
        label.element.id,
        `No collision-free external label position could be found (${label.element.id}).`
      );
    }
    label.di.label = factory.createDiLabel(integerBounds(candidate));
    occupied.push(candidate);
  }
}
function needsExpandedSubProcessTitleClearance(element, rect, childLayout) {
  const expandedElements = collectExpandedElements(childLayout);
  const shapes = [
    ...childLayout.shapes.entries(),
    ...getExpandedChildShapes(childLayout)
  ].map(([childElement, childRect], index) => {
    const expanded = expandedElements.has(childElement);
    return {
      element: childElement,
      rect: childRect,
      index,
      isContainer: expanded || is(childElement, "bpmn:Participant") || is(childElement, "bpmn:Lane"),
      titleBounds: expandedSubProcessTitleBounds(
        childElement,
        childRect,
        expanded
      )
    };
  });
  const container = {
    element,
    rect,
    isContainer: true,
    titleBounds: expandedSubProcessTitleBounds(element, rect, true)
  };
  const allShapes = [container, ...shapes];
  const edges = [
    ...childLayout.edges.entries(),
    ...getExpandedChildEdges(childLayout)
  ].map(([childElement, points], index) => ({
    element: childElement,
    points,
    index
  }));
  const edgeSegments = flattenEdgeSegments(edges);
  const shapeByElement = new Map(shapes.map((shape) => [shape.element, shape]));
  const labels = [
    ...shapes.map((shape) => labelRecord(shape, shape.index)),
    ...edges.map((edge) => labelRecord(edge, shapes.length + edge.index))
  ].filter(Boolean);
  return labels.some((label) => {
    const preferred = preferredCandidates(label, shapeByElement, edges);
    const hasClearPreferred = preferred.some((candidate) => {
      return candidateIsClear(candidate, label, allShapes, edgeSegments, []);
    });
    const hasTitleBlockedPreferred = preferred.some((candidate) => {
      return overlapsAnyContainerTitle(candidate, allShapes) && candidateIsCollisionFree(
        candidate,
        allShapes,
        edgeSegments,
        [],
        true
      ) && hasClearOwnerCorridor(candidate, label, allShapes);
    });
    return !hasClearPreferred && hasTitleBlockedPreferred;
  });
}
function collectExpandedElements(layout) {
  const elements = /* @__PURE__ */ new Set();
  for (const child of layout.children) {
    if (!child.emitInParent) {
      continue;
    }
    elements.add(child.scope);
    for (const element of collectExpandedElements(child)) {
      elements.add(element);
    }
  }
  return elements;
}
function labelRecord(owner, index) {
  const element = owner.element;
  const text = isExternalLabelOwner(element) ? getExternalLabelText(element).trim() : "";
  if (!text) {
    return null;
  }
  return {
    ...owner,
    index,
    text,
    size: externalLabelSize(text)
  };
}
function externalLabelSize(text) {
  const availableWidth = EXTERNAL_LABEL_WIDTH - 2 * EXTERNAL_LABEL_HORIZONTAL_PADDING;
  let lineCount = 0;
  let maxLineWidth = 0;
  for (const paragraph of text.trim().split(/\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let lineWidth = 0;
    let paragraphLines = 1;
    for (const word of words) {
      const chunks = wordChunks(word);
      for (let index = 0; index < chunks.length; index++) {
        const chunkWidth = chunks[index];
        const separator = lineWidth && index === 0 ? EXTERNAL_LABEL_SPACE_WIDTH : 0;
        if (!lineWidth) {
          lineWidth = chunkWidth;
        } else if (index === 0 && lineWidth + separator + chunkWidth <= availableWidth) {
          lineWidth += separator + chunkWidth;
        } else {
          maxLineWidth = Math.max(maxLineWidth, lineWidth);
          paragraphLines++;
          lineWidth = chunkWidth;
        }
      }
    }
    lineCount += paragraphLines;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }
  return {
    width: Math.min(
      EXTERNAL_LABEL_WIDTH,
      maxLineWidth + 2 * EXTERNAL_LABEL_HORIZONTAL_PADDING
    ),
    height: Math.max(
      EXTERNAL_LABEL_LINE_HEIGHT,
      lineCount * EXTERNAL_LABEL_LINE_HEIGHT
    )
  };
}
function wordChunks(word) {
  const chunks = [];
  let width = 0;
  for (const character of word) {
    const characterWidth = externalCharacterWidth(character);
    if (width && width + characterWidth > EXTERNAL_LABEL_WIDTH - 2 * EXTERNAL_LABEL_HORIZONTAL_PADDING) {
      chunks.push(width);
      width = characterWidth;
    } else {
      width += characterWidth;
    }
  }
  if (width) {
    chunks.push(width);
  }
  return chunks;
}
function externalCharacterWidth(character) {
  if (/[MW]/.test(character)) {
    return EXTERNAL_LABEL_WIDE_CHARACTER_WIDTH;
  }
  if (/[mw]/.test(character)) {
    return EXTERNAL_LABEL_WIDE_CHARACTER_WIDTH - 1;
  }
  if (/[A-Z]/.test(character)) {
    return EXTERNAL_LABEL_UPPERCASE_WIDTH;
  }
  return EXTERNAL_LABEL_CHARACTER_WIDTH;
}
function preferredCandidates(label, shapeByElement, edges) {
  if (label.points) {
    return connectionLabelCandidates(label, edges);
  }
  const owner = shapeByElement.get(label.element);
  if (!owner) {
    return [];
  }
  const candidates = shapeLabelCandidates(owner.rect, label.size);
  return is(label.element, "bpmn:Group") ? [candidates[1], candidates[0], candidates[2], candidates[3]] : candidates;
}
function shapeLabelCandidates(owner, size) {
  const centerX = owner.x + owner.width / 2;
  const centerY = owner.y + owner.height / 2;
  return [
    bounds(
      centerX - size.width / 2,
      owner.y + owner.height + EXTERNAL_LABEL_CLEARANCE,
      size.width,
      size.height
    ),
    bounds(
      centerX - size.width / 2,
      owner.y - EXTERNAL_LABEL_CLEARANCE - size.height,
      size.width,
      size.height
    ),
    bounds(
      owner.x - EXTERNAL_LABEL_CLEARANCE - size.width,
      centerY - size.height / 2,
      size.width,
      size.height
    ),
    bounds(
      owner.x + owner.width + EXTERNAL_LABEL_CLEARANCE,
      centerY - size.height / 2,
      size.width,
      size.height
    )
  ];
}
function connectionLabelCandidates(label, edges) {
  const segments = label.points.slice(0, -1).map((start, index) => ({
    start,
    end: label.points[index + 1],
    index
  })).filter(({ start, end }) => start.x !== end.x || start.y !== end.y);
  const middle = (segments.length - 1) / 2;
  const partitioned = segments.map((segment) => {
    return partitionConnectionSegment(segment, label.element, edges);
  });
  const unique = partitioned.flatMap((parts) => parts.unique);
  const shared = partitioned.flatMap((parts) => parts.shared);
  const compare = (a, b) => {
    return Math.abs(a.index - middle) - Math.abs(b.index - middle) || a.index - b.index || a.centerOffset - b.centerOffset;
  };
  return [...unique.sort(compare), ...shared.sort(compare)].flatMap((segment) => {
    return segmentLabelCandidates(segment.start, segment.end, label.size);
  });
}
function partitionConnectionSegment(segment, owner, edges) {
  const horizontal = segment.start.y === segment.end.y;
  const vertical = segment.start.x === segment.end.x;
  if (!horizontal && !vertical) {
    return {
      unique: [segmentPart(segment, segment.start, segment.end)],
      shared: []
    };
  }
  const start = horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y);
  const end = horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y);
  const overlaps = [];
  for (const edge of edges) {
    if (edge.element === owner) {
      continue;
    }
    for (let index = 0; index < edge.points.length - 1; index++) {
      const otherStart = edge.points[index];
      const otherEnd = edge.points[index + 1];
      const collinear = horizontal ? otherStart.y === otherEnd.y && otherStart.y === segment.start.y : otherStart.x === otherEnd.x && otherStart.x === segment.start.x;
      if (!collinear) {
        continue;
      }
      const otherMin = horizontal ? Math.min(otherStart.x, otherEnd.x) : Math.min(otherStart.y, otherEnd.y);
      const otherMax = horizontal ? Math.max(otherStart.x, otherEnd.x) : Math.max(otherStart.y, otherEnd.y);
      const overlapStart = Math.max(start, otherMin);
      const overlapEnd = Math.min(end, otherMax);
      if (overlapEnd > overlapStart) {
        overlaps.push([overlapStart, overlapEnd]);
      }
    }
  }
  const merged = mergeIntervals(overlaps);
  const unique = [];
  const shared = [];
  let cursor = start;
  for (const [overlapStart, overlapEnd] of merged) {
    if (overlapStart > cursor) {
      unique.push(toSegmentPart(segment, cursor, overlapStart, horizontal));
    }
    shared.push(toSegmentPart(segment, overlapStart, overlapEnd, horizontal));
    cursor = overlapEnd;
  }
  if (cursor < end) {
    unique.push(toSegmentPart(segment, cursor, end, horizontal));
  }
  return { unique, shared };
}
function mergeIntervals(intervals) {
  const merged = [];
  for (const interval of intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], interval[1]);
    } else {
      merged.push([...interval]);
    }
  }
  return merged;
}
function toSegmentPart(segment, start, end, horizontal) {
  return segmentPart(
    segment,
    horizontal ? { x: start, y: segment.start.y } : { x: segment.start.x, y: start },
    horizontal ? { x: end, y: segment.start.y } : { x: segment.start.x, y: end }
  );
}
function segmentPart(segment, start, end) {
  const originalCenter = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2
  };
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  return {
    start,
    end,
    index: segment.index,
    centerOffset: Math.hypot(
      center.x - originalCenter.x,
      center.y - originalCenter.y
    )
  };
}
function segmentLabelCandidates(start, end, size) {
  const horizontal = start.y === end.y;
  const vertical = start.x === end.x;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const offsets = [0];
  for (let offset = ROUTING_MARGIN; offset <= length / 2; offset += ROUTING_MARGIN) {
    offsets.push(offset, -offset);
  }
  if (horizontal) {
    const centerX = (start.x + end.x) / 2;
    const gap = Math.max(
      EXTERNAL_LABEL_CLEARANCE,
      FLOW_LABEL_INDENT - size.height / 2
    );
    return offsets.flatMap((offset) => [
      bounds(
        centerX + offset - size.width / 2,
        start.y - gap - size.height,
        size.width,
        size.height
      ),
      bounds(
        centerX + offset - size.width / 2,
        start.y + gap,
        size.width,
        size.height
      )
    ]);
  }
  if (vertical) {
    const centerY = (start.y + end.y) / 2;
    const gap = Math.max(
      EXTERNAL_LABEL_CLEARANCE,
      FLOW_LABEL_INDENT - size.width / 2
    );
    return offsets.flatMap((offset) => [
      bounds(
        start.x + gap,
        centerY + offset - size.height / 2,
        size.width,
        size.height
      ),
      bounds(
        start.x - gap - size.width,
        centerY + offset - size.height / 2,
        size.width,
        size.height
      )
    ]);
  }
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  const normal = {
    x: -(end.y - start.y) / length,
    y: (end.x - start.x) / length
  };
  const distance = EXTERNAL_LABEL_CLEARANCE + Math.hypot(size.width, size.height) / 2;
  return [1, -1].map((direction) => bounds(
    midpoint.x + normal.x * distance * direction - size.width / 2,
    midpoint.y + normal.y * distance * direction - size.height / 2,
    size.width,
    size.height
  ));
}
function freeCandidate(label, preferred, shapes, edgeSegments, occupied) {
  if (!preferred) {
    return null;
  }
  const candidates = [];
  let detachedFallback = false;
  for (let step = 1; step <= MAX_LABEL_SEARCH_STEPS; step++) {
    for (let dx = -step; dx <= step; dx++) {
      const dy = step - Math.abs(dx);
      const offsets = dy ? [dy, -dy] : [0];
      for (const offsetY of offsets) {
        const candidate = {
          rect: bounds(
            preferred.x + dx * ROUTING_MARGIN,
            preferred.y + offsetY * ROUTING_MARGIN,
            label.size.width,
            label.size.height
          ),
          displacement: step,
          index: candidates.length
        };
        candidates.push(candidate);
        if (!detachedFallback && candidateIsCollisionFree(candidate.rect, shapes, edgeSegments, occupied)) {
          if (hasClearOwnerCorridor(candidate.rect, label, shapes)) {
            return candidate.rect;
          }
          detachedFallback = true;
        }
      }
    }
  }
  if (!detachedFallback) {
    return null;
  }
  for (const candidate of candidates) {
    candidate.ownerDistance = ownerAttachment(label, candidate.rect).distance;
  }
  candidates.sort((a, b) => {
    return a.ownerDistance - b.ownerDistance || a.displacement - b.displacement || a.index - b.index;
  });
  return candidates.map((candidate) => candidate.rect).find((candidate) => {
    return candidateIsClear(candidate, label, shapes, edgeSegments, occupied);
  }) || null;
}
function candidateIsClear(candidate, label, shapes, edgeSegments, occupied) {
  return candidateIsCollisionFree(candidate, shapes, edgeSegments, occupied) && hasClearOwnerCorridor(candidate, label, shapes);
}
function candidateIsCollisionFree(candidate, shapes, edgeSegments, occupied, ignoreContainerTitles = false) {
  const footprint = expand(candidate, EXTERNAL_LABEL_CLEARANCE);
  const edgeFootprint = expand(candidate, EXTERNAL_LABEL_CLEARANCE - 1);
  if (occupied.some((label) => rectanglesOverlap(footprint, expand(label, EXTERNAL_LABEL_CLEARANCE)))) {
    return false;
  }
  for (const shape of shapes) {
    if (shape.isContainer) {
      if (straddles(candidate, shape.rect) || overlapsParticipantHeader(candidate, shape) || !ignoreContainerTitles && overlapsContainerTitle(footprint, shape)) {
        return false;
      }
    } else if (rectanglesOverlap(footprint, shape.rect)) {
      return false;
    }
  }
  const edgeFootprintMaxX = edgeFootprint.x + edgeFootprint.width;
  const edgeFootprintMaxY = edgeFootprint.y + edgeFootprint.height;
  for (const segment of edgeSegments) {
    if (segment.maxX < edgeFootprint.x || segment.minX > edgeFootprintMaxX || segment.maxY < edgeFootprint.y || segment.minY > edgeFootprintMaxY) {
      continue;
    }
    if (segmentEntersRect(segment.start, segment.end, edgeFootprint)) {
      return false;
    }
  }
  return true;
}
function flattenEdgeSegments(edges) {
  const segments = [];
  for (const edge of edges) {
    for (let index = 0; index < edge.points.length - 1; index++) {
      const start = edge.points[index];
      const end = edge.points[index + 1];
      segments.push({
        start,
        end,
        minX: Math.min(start.x, end.x),
        maxX: Math.max(start.x, end.x),
        minY: Math.min(start.y, end.y),
        maxY: Math.max(start.y, end.y)
      });
    }
  }
  return segments;
}
function overlapsAnyContainerTitle(candidate, shapes) {
  const footprint = expand(candidate, EXTERNAL_LABEL_CLEARANCE);
  return shapes.some((shape) => {
    return shape.isContainer && overlapsContainerTitle(footprint, shape);
  });
}
function hasClearOwnerCorridor(candidate, label, shapes) {
  const attachment2 = ownerAttachment(label, candidate);
  return !shapes.some((shape) => {
    return !shape.isContainer && shape.element !== label.element && segmentEntersRect(
      attachment2.labelPoint,
      attachment2.ownerPoint,
      shape.rect
    );
  });
}
function ownerAttachment(label, candidate) {
  if (label.rect) {
    return rectangleAttachment(candidate, label.rect);
  }
  return polylineAttachment(candidate, label.points);
}
function rectangleAttachment(candidate, owner) {
  const [labelX, ownerX] = closestAxisPoints(
    candidate.x,
    candidate.x + candidate.width,
    owner.x,
    owner.x + owner.width
  );
  const [labelY, ownerY] = closestAxisPoints(
    candidate.y,
    candidate.y + candidate.height,
    owner.y,
    owner.y + owner.height
  );
  return attachment(
    { x: labelX, y: labelY },
    { x: ownerX, y: ownerY }
  );
}
function closestAxisPoints(aStart, aEnd, bStart, bEnd) {
  if (aEnd < bStart) {
    return [aEnd, bStart];
  }
  if (bEnd < aStart) {
    return [aStart, bEnd];
  }
  const shared = (Math.max(aStart, bStart) + Math.min(aEnd, bEnd)) / 2;
  return [shared, shared];
}
function polylineAttachment(candidate, points) {
  let closest = null;
  for (let index = 0; index < points.length - 1; index++) {
    const current = segmentRectangleAttachment(
      candidate,
      points[index],
      points[index + 1]
    );
    if (!closest || current.distance < closest.distance) {
      closest = current;
    }
  }
  return closest;
}
function segmentRectangleAttachment(rect, start, end) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  const candidates = corners.map((labelPoint) => {
    return attachment(labelPoint, closestPointOnSegment(labelPoint, start, end));
  });
  for (const ownerPoint of [start, end]) {
    candidates.push(attachment(
      closestPointInRectangle(ownerPoint, rect),
      ownerPoint
    ));
  }
  return candidates.reduce((closest, current) => {
    return current.distance < closest.distance ? current : closest;
  });
}
function closestPointOnSegment(candidate, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared ? Math.max(0, Math.min(
    1,
    ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSquared
  )) : 0;
  return {
    x: start.x + ratio * dx,
    y: start.y + ratio * dy
  };
}
function closestPointInRectangle(candidate, rect) {
  return {
    x: Math.max(rect.x, Math.min(candidate.x, rect.x + rect.width)),
    y: Math.max(rect.y, Math.min(candidate.y, rect.y + rect.height))
  };
}
function attachment(labelPoint, ownerPoint) {
  return {
    labelPoint,
    ownerPoint,
    distance: Math.hypot(
      ownerPoint.x - labelPoint.x,
      ownerPoint.y - labelPoint.y
    )
  };
}
function isContainer(di) {
  return di.isExpanded === true || is(di.bpmnElement, "bpmn:Participant") || is(di.bpmnElement, "bpmn:Lane") || is(di.bpmnElement, "bpmn:Group");
}
function straddles(candidate, container) {
  return rectanglesOverlap(candidate, container) && !contains(container, candidate);
}
function contains(container, candidate) {
  return candidate.x >= container.x && candidate.y >= container.y && candidate.x + candidate.width <= container.x + container.width && candidate.y + candidate.height <= container.y + container.height;
}
function overlapsParticipantHeader(candidate, shape) {
  if (!is(shape.element, "bpmn:Participant")) {
    return false;
  }
  return rectanglesOverlap(candidate, bounds(
    shape.rect.x,
    shape.rect.y,
    PARTICIPANT_HEADER_WIDTH,
    shape.rect.height
  ));
}
function overlapsContainerTitle(candidate, shape) {
  if (!shape.titleBounds) {
    return false;
  }
  return rectanglesOverlap(candidate, shape.titleBounds);
}
function expandedSubProcessTitleBounds(element, rect, expanded) {
  if (!expanded || !hasSubProcessLabel(element)) {
    return null;
  }
  const maximumWidth = Math.max(
    0,
    rect.width - 2 * EXPANDED_SUBPROCESS_LABEL_PADDING
  );
  const textWidth = Math.max(...element.name.split("\n").map((line) => {
    return [...line].reduce((width2, character) => {
      return width2 + (character === " " ? EXTERNAL_LABEL_SPACE_WIDTH : externalCharacterWidth(character));
    }, 0);
  }));
  const width = Math.min(
    maximumWidth,
    textWidth + 2 * EXPANDED_SUBPROCESS_LABEL_PADDING
  );
  return bounds(
    rect.x + (rect.width - width) / 2,
    rect.y,
    width,
    EXPANDED_SUBPROCESS_LABEL_HEIGHT
  );
}
function expand(rect, margin) {
  return bounds(
    rect.x - margin,
    rect.y - margin,
    rect.width + 2 * margin,
    rect.height + 2 * margin
  );
}
function layoutGroups(groups, layout) {
  const warnings = [];
  const shapes = [
    ...layout.shapes.entries(),
    ...getExpandedChildShapes(layout)
  ];
  const edges = [
    ...layout.edges.entries(),
    ...getExpandedChildEdges(layout)
  ];
  for (const group of groups) {
    const categoryValue = group.categoryValueRef;
    const memberShapes = shapes.filter(([element]) => {
      return referencesCategoryValue(element, categoryValue);
    });
    const memberEdges = edges.filter(([element]) => {
      return referencesCategoryValue(element, categoryValue);
    });
    const points = [
      ...memberShapes.flatMap(([, rect]) => [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height }
      ]),
      ...memberEdges.flatMap(([, waypoints]) => waypoints)
    ];
    if (!points.length) {
      warnings.push(new LayoutWarning(
        "GROUP_MEMBERS_NOT_FOUND",
        group.id,
        `Group ${group.id} has no visible explicitly referenced members and was omitted.`
      ));
      continue;
    }
    const minX = Math.min(...points.map((point2) => point2.x));
    const minY = Math.min(...points.map((point2) => point2.y));
    const maxX = Math.max(...points.map((point2) => point2.x));
    const maxY = Math.max(...points.map((point2) => point2.y));
    layout.shapes.set(group, bounds(
      minX - GROUP_PADDING,
      minY - GROUP_PADDING,
      maxX - minX + 2 * GROUP_PADDING,
      maxY - minY + 2 * GROUP_PADDING
    ));
  }
  return warnings;
}
function referencesCategoryValue(element, categoryValue) {
  if (!categoryValue) {
    return false;
  }
  const references = Array.isArray(element.categoryValueRef) ? element.categoryValueRef : [];
  return references.some((reference) => {
    return reference === categoryValue || reference.id === categoryValue.id;
  });
}
function emitLayout(factory, layout, planeElements) {
  for (const [element, rect] of layout.shapes) {
    const attrs = {};
    if (is(element, "bpmn:SubProcess") && layout.children.some((child) => child.scope === element && child.emitInParent)) {
      attrs.isExpanded = true;
    }
    if (is(element, "bpmn:Participant") || is(element, "bpmn:Lane")) {
      attrs.isHorizontal = true;
    }
    if (is(element, "bpmn:Gateway")) {
      attrs.isMarkerVisible = true;
    }
    planeElements.push(factory.createDiShape(element, integerBounds(rect), {
      id: `BPMNShape_${element.id}`,
      ...attrs
    }));
  }
  const emittedShapes = new Map([
    ...layout.shapes,
    ...getExpandedChildShapes(layout)
  ]);
  for (const [element, points] of layout.edges) {
    const routedConnections = [...layout.edges].filter(([candidate]) => candidate !== element).map(([flow, candidatePoints]) => ({ flow, points: candidatePoints }));
    planeElements.push(factory.createDiEdge(element, orientDockingPoints(
      element,
      cleanPoints(points),
      emittedShapes,
      routedConnections
    ), {
      id: `BPMNEdge_${element.id}`
    }));
  }
  for (const child of layout.children) {
    if (child.emitInParent) {
      emitLayout(factory, child, planeElements);
    }
  }
}
function orientDockingPoints(element, points, shapes, routedConnections) {
  if (is(element, "bpmn:Association") || is(element, "bpmn:DataAssociation")) {
    return points;
  }
  const source = Array.isArray(element.sourceRef) ? element.sourceRef[0] : element.sourceRef;
  const sourceBounds = shapes.get(source);
  const targetBounds = shapes.get(element.targetRef);
  const boundaryRoute = sourceBounds && targetBounds ? enforceBoundaryVerticalExit(
    element,
    source,
    points,
    sourceBounds,
    targetBounds,
    shapes,
    routedConnections
  ) : points;
  const elbowRoute = sourceBounds && targetBounds ? flipTangentElbow(
    element,
    source,
    boundaryRoute,
    sourceBounds,
    targetBounds,
    shapes
  ) : boundaryRoute;
  const route = sourceBounds && targetBounds ? centerOrthogonalElbow(
    element,
    source,
    elbowRoute,
    sourceBounds,
    targetBounds,
    shapes,
    routedConnections
  ) : elbowRoute;
  const oriented = route.map(({ x, y }) => point(x, y));
  if (sourceBounds) {
    orientPlaneEdgeDocking(oriented, sourceBounds, true, true);
  }
  if (targetBounds) {
    orientPlaneEdgeDocking(oriented, targetBounds, false, true);
  }
  return cleanPoints(oriented);
}
function enforceBoundaryVerticalExit(element, sourceElement, points, sourceBounds, targetBounds, shapes, routedConnections) {
  if (!is(sourceElement, "bpmn:BoundaryEvent") || points.length < 2) {
    return points;
  }
  const host = shapes.get(sourceElement.attachedToRef);
  const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
  const sourceTop = host && Math.abs(sourceCenterY - host.y) < Math.abs(sourceCenterY - (host.y + host.height));
  const sourceDock = point(
    sourceBounds.x + sourceBounds.width / 2,
    sourceTop ? sourceBounds.y : sourceBounds.y + sourceBounds.height
  );
  const direction = sourceTop ? -1 : 1;
  if (points[0].x === sourceDock.x && points[0].y === sourceDock.y && points[1].x === sourceDock.x && Math.sign(points[1].y - sourceDock.y) === direction) {
    return points;
  }
  const stub = point(sourceDock.x, sourceDock.y + direction * ROUTING_MARGIN);
  const targetDock = facingDock(sourceDock, targetBounds);
  const obstacles = connectionObstacles(shapes);
  const targetDocks = [
    targetDock,
    oppositeDock(targetDock, targetBounds)
  ];
  let fallback = null;
  for (const candidateDock of targetDocks) {
    const targetStub = outwardDockingStub(candidateDock, targetBounds);
    const route = visibilityRoute(
      stub,
      targetStub,
      obstacles,
      sourceElement,
      element.targetRef,
      routedConnections
    ) || visibilityRoute(
      stub,
      targetStub,
      obstacles,
      sourceElement,
      element.targetRef,
      []
    );
    if (!route) {
      continue;
    }
    const candidate = cleanPoints([sourceDock, ...route, candidateDock]);
    fallback ||= candidate;
    if (!hasUTurn(candidate)) {
      return candidate;
    }
  }
  return fallback || points;
}
function outwardDockingStub(dock, rect) {
  if (dock.x === rect.x) {
    return point(dock.x - ROUTING_MARGIN, dock.y);
  }
  if (dock.x === rect.x + rect.width) {
    return point(dock.x + ROUTING_MARGIN, dock.y);
  }
  if (dock.y === rect.y) {
    return point(dock.x, dock.y - ROUTING_MARGIN);
  }
  return point(dock.x, dock.y + ROUTING_MARGIN);
}
function oppositeDock(dock, rect) {
  if (dock.x === rect.x) {
    return point(rect.x + rect.width, rect.y + rect.height / 2);
  }
  if (dock.x === rect.x + rect.width) {
    return point(rect.x, rect.y + rect.height / 2);
  }
  if (dock.y === rect.y) {
    return point(rect.x + rect.width / 2, rect.y + rect.height);
  }
  return point(rect.x + rect.width / 2, rect.y);
}
function hasUTurn(points) {
  for (let index = 1; index < points.length - 1; index++) {
    const incomingX = points[index].x - points[index - 1].x;
    const incomingY = points[index].y - points[index - 1].y;
    const outgoingX = points[index + 1].x - points[index].x;
    const outgoingY = points[index + 1].y - points[index].y;
    const cross = incomingX * outgoingY - incomingY * outgoingX;
    const dot = incomingX * outgoingX + incomingY * outgoingY;
    if (cross === 0 && dot < 0) {
      return true;
    }
  }
  return false;
}
function facingDock(source, rect) {
  if (source.x < rect.x) {
    return point(rect.x, rect.y + rect.height / 2);
  }
  if (source.x > rect.x + rect.width) {
    return point(rect.x + rect.width, rect.y + rect.height / 2);
  }
  if (source.y < rect.y) {
    return point(rect.x + rect.width / 2, rect.y);
  }
  return point(rect.x + rect.width / 2, rect.y + rect.height);
}
function centerOrthogonalElbow(element, sourceElement, points, sourceBounds, targetBounds, shapes, routedConnections) {
  if (!is(element, "bpmn:SequenceFlow") || points.length !== 3) {
    return points;
  }
  const [start, elbow, end] = points;
  const sourceVertical = start.x === elbow.x && start.y !== elbow.y;
  const sourceHorizontal = start.y === elbow.y && start.x !== elbow.x;
  const targetVertical = end.x === elbow.x && end.y !== elbow.y;
  const targetHorizontal = end.y === elbow.y && end.x !== elbow.x;
  if (!(sourceVertical && targetHorizontal || sourceHorizontal && targetVertical)) {
    return points;
  }
  const sourceDock = sourceVertical ? point(
    sourceBounds.x + sourceBounds.width / 2,
    elbow.y < start.y ? sourceBounds.y : sourceBounds.y + sourceBounds.height
  ) : point(
    elbow.x < start.x ? sourceBounds.x : sourceBounds.x + sourceBounds.width,
    sourceBounds.y + sourceBounds.height / 2
  );
  const targetDock = targetVertical ? point(
    targetBounds.x + targetBounds.width / 2,
    elbow.y < end.y ? targetBounds.y : targetBounds.y + targetBounds.height
  ) : point(
    elbow.x < end.x ? targetBounds.x : targetBounds.x + targetBounds.width,
    targetBounds.y + targetBounds.height / 2
  );
  const centered = sourceVertical ? [sourceDock, point(sourceDock.x, targetDock.y), targetDock] : [sourceDock, point(targetDock.x, sourceDock.y), targetDock];
  const obstacles = connectionObstacles(shapes);
  if (endpointRouteIsClear(
    centered,
    obstacles,
    sourceElement,
    element.targetRef,
    routedConnections
  )) {
    return centered;
  }
  const sourceCenterX = sourceBounds.x + sourceBounds.width / 2;
  const sourceCenterY = sourceBounds.y + sourceBounds.height / 2;
  const targetCenterX = targetBounds.x + targetBounds.width / 2;
  const targetCenterY = targetBounds.y + targetBounds.height / 2;
  const transposedSourceDock = sourceVertical ? point(
    targetCenterX < sourceCenterX ? sourceBounds.x : sourceBounds.x + sourceBounds.width,
    sourceCenterY
  ) : point(
    sourceCenterX,
    targetCenterY < sourceCenterY ? sourceBounds.y : sourceBounds.y + sourceBounds.height
  );
  const transposedTargetDock = sourceVertical ? point(
    targetCenterX,
    sourceCenterY < targetCenterY ? targetBounds.y : targetBounds.y + targetBounds.height
  ) : point(
    sourceCenterX < targetCenterX ? targetBounds.x : targetBounds.x + targetBounds.width,
    targetCenterY
  );
  const transposed = sourceVertical ? [
    transposedSourceDock,
    point(transposedTargetDock.x, transposedSourceDock.y),
    transposedTargetDock
  ] : [
    transposedSourceDock,
    point(transposedSourceDock.x, transposedTargetDock.y),
    transposedTargetDock
  ];
  const alternateTargetDock = sourceVertical ? point(
    targetCenterX,
    sourceCenterY < targetCenterY ? targetBounds.y : targetBounds.y + targetBounds.height
  ) : point(
    sourceCenterX < targetCenterX ? targetBounds.x : targetBounds.x + targetBounds.width,
    targetCenterY
  );
  const direction = sourceVertical ? alternateTargetDock.y === targetBounds.y ? -1 : 1 : alternateTargetDock.x === targetBounds.x ? -1 : 1;
  const channel = sourceVertical ? alternateTargetDock.y + direction * ROUTING_MARGIN : alternateTargetDock.x + direction * ROUTING_MARGIN;
  const bypass = sourceVertical ? [
    sourceDock,
    point(sourceDock.x, channel),
    point(alternateTargetDock.x, channel),
    alternateTargetDock
  ] : [
    sourceDock,
    point(channel, sourceDock.y),
    point(channel, alternateTargetDock.y),
    alternateTargetDock
  ];
  if (endpointRouteIsClear(
    bypass,
    obstacles,
    sourceElement,
    element.targetRef,
    routedConnections
  )) {
    return bypass;
  }
  if (endpointRouteIsClear(
    transposed,
    obstacles,
    sourceElement,
    element.targetRef,
    routedConnections
  )) {
    return transposed;
  }
  const facingSourceDock = facingDock(point(targetCenterX, targetCenterY), sourceBounds);
  const facingTargetDock = facingDock(point(sourceCenterX, sourceCenterY), targetBounds);
  const sourceStub = outwardDockingStub(facingSourceDock, sourceBounds);
  const targetStub = outwardDockingStub(facingTargetDock, targetBounds);
  if (endpointRouteIsClear(
    centered,
    obstacles,
    sourceElement,
    element.targetRef,
    []
  )) {
    return centered;
  }
  if (endpointRouteIsClear(
    bypass,
    obstacles,
    sourceElement,
    element.targetRef,
    []
  )) {
    return bypass;
  }
  if (endpointRouteIsClear(
    transposed,
    obstacles,
    sourceElement,
    element.targetRef,
    []
  )) {
    return transposed;
  }
  const visibilityRouteWithCrossings = visibilityRoute(
    sourceStub,
    targetStub,
    obstacles,
    sourceElement,
    element.targetRef,
    []
  );
  return visibilityRouteWithCrossings ? cleanPoints([
    facingSourceDock,
    ...visibilityRouteWithCrossings,
    facingTargetDock
  ]) : points;
}
function endpointRouteIsClear(points, obstacles, sourceElement, targetElement, routedConnections) {
  if (!pathIsClear(points, obstacles, sourceElement, targetElement, [])) {
    return false;
  }
  return !toSegments(points).some(([a, b]) => {
    return routedConnections.some((connection) => {
      return toSegments(connection.points).some(([c, d]) => {
        return segmentsProperlyCross(a, b, c, d);
      });
    });
  });
}
function flipTangentElbow(element, sourceElement, points, sourceBounds, targetBounds, shapes) {
  if (!is(sourceElement, "bpmn:BoundaryEvent") || points.length !== 3 || dockingDirectionMatches(points[0], points[1], sourceBounds) || dockingDirectionMatches(points.at(-1), points.at(-2), targetBounds)) {
    return points;
  }
  const alternate = cleanPoints([
    points[0],
    point(points[0].x, points.at(-1).y),
    points.at(-1)
  ]);
  if (alternate.length !== 3) {
    return points;
  }
  return pathIsClear(
    alternate,
    connectionObstacles(shapes),
    sourceElement,
    element.targetRef,
    []
  ) ? alternate : points;
}
function connectionObstacles(shapes) {
  return [...shapes.entries()].filter(([candidate]) => {
    return !is(candidate, "bpmn:Lane") && !is(candidate, "bpmn:Participant") && !isArtifact(candidate);
  }).map(([candidate, rect]) => ({ element: candidate, rect }));
}
function orientPlaneDockings(factory, planeElements) {
  const shapes = new Map(
    planeElements.filter((di) => di.$instanceOf("bpmndi:BPMNShape")).map((di) => [di.bpmnElement.id, di])
  );
  for (const di of planeElements.filter((di2) => di2.$instanceOf("bpmndi:BPMNEdge"))) {
    const points = di.waypoint;
    if (points.length < 2) {
      continue;
    }
    const element = di.bpmnElement;
    const source = Array.isArray(element.sourceRef) ? element.sourceRef[0] : element.sourceRef;
    const sourceShape = shapes.get(source?.id);
    const targetShape = shapes.get(element.targetRef?.id);
    const sourceBounds = sourceShape?.bounds;
    const targetBounds = targetShape?.bounds;
    const requireOrthogonal = !is(element, "bpmn:Association") && !is(element, "bpmn:DataAssociation");
    if (sourceBounds) {
      orientPlaneEdgeDocking(
        points,
        sourceBounds,
        true,
        true,
        (x, y) => factory.createDiWaypoint({ x, y }),
        requireOrthogonal,
        requiresCenteredDocking(sourceShape?.bpmnElement)
      );
    }
    if (targetBounds) {
      orientPlaneEdgeDocking(
        points,
        targetBounds,
        false,
        true,
        (x, y) => factory.createDiWaypoint({ x, y }),
        requireOrthogonal,
        requiresCenteredDocking(targetShape?.bpmnElement)
      );
    }
  }
}
function orientPlaneEdgeDocking(points, rect, source, allowDogleg = false, createPoint = point, requireOrthogonal = true, centerSides = false) {
  while (points.length > 1) {
    const endpointIndex = source ? 0 : points.length - 1;
    const adjacentIndex = source ? 1 : points.length - 2;
    const endpoint = points[endpointIndex];
    const adjacent = points[adjacentIndex];
    let dock = orientDockingPoint(endpoint, adjacent, rect, requireOrthogonal);
    if (centerSides) {
      dock = centerDockingPoint(dock, adjacent, rect);
      if (dock.x !== endpoint.x || dock.y !== endpoint.y) {
        endpoint.x = dock.x;
        endpoint.y = dock.y;
        if (allowDogleg && endpoint.x !== adjacent.x && endpoint.y !== adjacent.y) {
          addDockingDogleg(points, endpointIndex, adjacent, rect, source, createPoint);
          return;
        }
      }
    }
    if (allowDogleg && requireOrthogonal && moveAmbiguousCornerDocking(endpoint, adjacent, rect)) {
      addDockingDogleg(
        points,
        endpointIndex,
        adjacent,
        rect,
        source,
        createPoint,
        true
      );
      return;
    }
    if (allowDogleg && requireOrthogonal && dockingDirectionMatches(endpoint, adjacent, rect, false) && !dockingDirectionMatches(endpoint, adjacent, rect, true)) {
      addDockingDogleg(points, endpointIndex, adjacent, rect, source, createPoint);
      return;
    }
    if (allowDogleg && dock.x === adjacent.x && dock.y === adjacent.y) {
      addDockingDogleg(points, endpointIndex, adjacent, rect, source, createPoint);
      return;
    }
    if (points.length > 2 && pointIsWithin(adjacent, rect)) {
      points.splice(adjacentIndex, 1);
      continue;
    }
    endpoint.x = dock.x;
    endpoint.y = dock.y;
    if (points.length > 2 && endpoint.x === adjacent.x && endpoint.y === adjacent.y) {
      points.splice(adjacentIndex, 1);
      continue;
    }
    return;
  }
}
function requiresCenteredDocking(element) {
  return is(element, "bpmn:Event") || is(element, "bpmn:Gateway");
}
function centerDockingPoint(dock, adjacent, rect) {
  if (dock.x === adjacent.x) {
    if (dock.y === rect.y) {
      return point(rect.x + rect.width / 2, rect.y);
    }
    if (dock.y === rect.y + rect.height) {
      return point(rect.x + rect.width / 2, rect.y + rect.height);
    }
  }
  if (dock.y === adjacent.y) {
    if (dock.x === rect.x) {
      return point(rect.x, rect.y + rect.height / 2);
    }
    if (dock.x === rect.x + rect.width) {
      return point(rect.x + rect.width, rect.y + rect.height / 2);
    }
  }
  return dock;
}
function addDockingDogleg(points, endpointIndex, adjacent, rect, source, createPoint, replaceAdjacentBridge = false) {
  const endpoint = points[endpointIndex];
  let outward;
  let bridge;
  const onHorizontalSide = (endpoint.y === rect.y || endpoint.y === rect.y + rect.height) && endpoint.x > rect.x && endpoint.x < rect.x + rect.width;
  if (onHorizontalSide || adjacent.y === endpoint.y && (endpoint.y === rect.y || endpoint.y === rect.y + rect.height)) {
    const direction = endpoint.y === rect.y ? -1 : 1;
    const y = endpoint.y + direction * ROUTING_MARGIN;
    outward = createPoint(endpoint.x, y);
    bridge = createPoint(adjacent.x, y);
  } else {
    const direction = endpoint.x === rect.x ? -1 : 1;
    const x = endpoint.x + direction * ROUTING_MARGIN;
    outward = createPoint(x, endpoint.y);
    bridge = createPoint(x, adjacent.y);
  }
  const continuationIndex = source ? 2 : endpointIndex - 2;
  const continuation = points[continuationIndex];
  const bridgeContinuesAdjacentSegment = replaceAdjacentBridge && continuation && (bridge.x === adjacent.x && continuation.x === adjacent.x || bridge.y === adjacent.y && continuation.y === adjacent.y);
  let dogleg;
  if (bridgeContinuesAdjacentSegment) {
    adjacent.x = bridge.x;
    adjacent.y = bridge.y;
    dogleg = [outward];
  } else {
    dogleg = bridge.x === adjacent.x && bridge.y === adjacent.y ? [outward] : [outward, bridge];
  }
  if (source) {
    points.splice(1, 0, ...dogleg);
  } else {
    points.splice(endpointIndex, 0, ...dogleg.reverse());
  }
}
function moveAmbiguousCornerDocking(endpoint, adjacent, rect) {
  const onVerticalSide = endpoint.x === rect.x || endpoint.x === rect.x + rect.width;
  const onHorizontalSide = endpoint.y === rect.y || endpoint.y === rect.y + rect.height;
  if (!onVerticalSide || !onHorizontalSide) {
    return false;
  }
  if (endpoint.y === adjacent.y) {
    endpoint.x += endpoint.x === rect.x ? ROUTING_MARGIN : -ROUTING_MARGIN;
    return true;
  }
  if (endpoint.x === adjacent.x) {
    endpoint.y += endpoint.y === rect.y ? ROUTING_MARGIN : -ROUTING_MARGIN;
    return true;
  }
  return false;
}
function pointIsWithin(candidatePoint, rect) {
  return candidatePoint.x >= rect.x && candidatePoint.x <= rect.x + rect.width && candidatePoint.y >= rect.y && candidatePoint.y <= rect.y + rect.height;
}
function orientDockingPoint(endpoint, adjacent, rect, requireOrthogonal = true) {
  if (dockingDirectionMatches(endpoint, adjacent, rect, requireOrthogonal)) {
    return endpoint;
  }
  if (endpoint.x === adjacent.x) {
    return point(
      endpoint.x,
      adjacent.y < endpoint.y ? rect.y : rect.y + rect.height
    );
  }
  if (endpoint.y === adjacent.y) {
    return point(
      adjacent.x < endpoint.x ? rect.x : rect.x + rect.width,
      endpoint.y
    );
  }
  if (adjacent.x < rect.x) {
    return point(rect.x, Math.max(rect.y, Math.min(adjacent.y, rect.y + rect.height)));
  }
  if (adjacent.x > rect.x + rect.width) {
    return point(
      rect.x + rect.width,
      Math.max(rect.y, Math.min(adjacent.y, rect.y + rect.height))
    );
  }
  if (adjacent.y < rect.y) {
    return point(Math.max(rect.x, Math.min(adjacent.x, rect.x + rect.width)), rect.y);
  }
  if (adjacent.y > rect.y + rect.height) {
    return point(
      Math.max(rect.x, Math.min(adjacent.x, rect.x + rect.width)),
      rect.y + rect.height
    );
  }
  return endpoint;
}
function dockingDirectionMatches(endpoint, adjacent, rect, requireOrthogonal = true) {
  const vertical = !requireOrthogonal || endpoint.x === adjacent.x;
  const horizontal = !requireOrthogonal || endpoint.y === adjacent.y;
  return vertical && (endpoint.y === rect.y && adjacent.y < endpoint.y || endpoint.y === rect.y + rect.height && adjacent.y > endpoint.y) || horizontal && (endpoint.x === rect.x && adjacent.x < endpoint.x || endpoint.x === rect.x + rect.width && adjacent.x > endpoint.x);
}
function compactParticipantRows(participants, participantShapes, participantLayouts) {
  let nextY = 0;
  let collapsedRow = [];
  let collapsedRowY = 0;
  for (const participant of participants) {
    const participantBounds = participantShapes.get(participant);
    const processLayout = participantLayouts.get(participant);
    if (processLayout) {
      const extents = getExtents(processLayout);
      const hasProcessGeometry = processLayout.shapes.size > 0;
      const footprintTop = hasProcessGeometry ? Math.min(0, extents.minY - participantBounds.y) : 0;
      const footprintBottom = hasProcessGeometry ? Math.max(participantBounds.height, extents.maxY - participantBounds.y) : participantBounds.height;
      const participantY = nextY - footprintTop;
      const dy = participantY - participantBounds.y;
      participantBounds.y = participantY;
      translateLayout(processLayout, 0, dy);
      nextY += footprintBottom - footprintTop + VERTICAL_GAP;
      collapsedRow = [];
      continue;
    }
    const fitsCurrentRow = collapsedRow.length && collapsedRow.every((rect) => {
      return rect.x + rect.width + HORIZONTAL_GAP <= participantBounds.x || participantBounds.x + participantBounds.width + HORIZONTAL_GAP <= rect.x;
    });
    if (fitsCurrentRow) {
      participantBounds.y = collapsedRowY;
      collapsedRow.push(participantBounds);
      continue;
    }
    participantBounds.y = nextY;
    collapsedRowY = nextY;
    collapsedRow = [participantBounds];
    nextY += participantBounds.height + VERTICAL_GAP;
  }
}
function getExpectedDiElements(root) {
  const elements = /* @__PURE__ */ new Set();
  const scopes = /* @__PURE__ */ new Set();
  const addIfExpected = (element) => {
    if (isSupportedVisualElement(element) || isSupportedVisualConnection(element)) {
      elements.add(element);
    }
  };
  const collectScope = (scope) => {
    if (scopes.has(scope)) {
      return;
    }
    scopes.add(scope);
    flattenLanes(scope.laneSets || []).forEach(addIfExpected);
    for (const element of scope.flowElements || []) {
      addIfExpected(element);
      for (const association of [
        ...element.dataInputAssociations || [],
        ...element.dataOutputAssociations || []
      ]) {
        addIfExpected(association);
      }
      if (is(element, "bpmn:SubProcess")) {
        collectScope(element);
      }
    }
    (scope.artifacts || []).forEach(addIfExpected);
  };
  if (is(root, "bpmn:Collaboration")) {
    (root.participants || []).forEach(addIfExpected);
    (root.messageFlows || []).forEach(addIfExpected);
    (root.artifacts || []).forEach(addIfExpected);
    for (const participant of root.participants || []) {
      if (participant.processRef) {
        collectScope(participant.processRef);
      }
    }
  } else {
    collectScope(root);
  }
  return elements;
}
function layoutProcess(xml3) {
  return new Layouter().layoutProcess(xml3);
}
var DiFactory, DEFAULT_TASK_HEIGHT, DEFAULT_TASK_WIDTH, LayoutError, LayoutWarning, HORIZONTAL_GAP, VERTICAL_GAP, OUTER_MARGIN, SUB_PROCESS_PADDING, ROUTING_MARGIN, MESSAGE_FLOW_BEND_PENALTY, PARTICIPANT_HEADER_WIDTH, LANE_CONTENT_PADDING, ANNOTATION_MIN_WIDTH, ANNOTATION_MAX_WIDTH, ANNOTATION_WIDTH_STEP, ANNOTATION_CHARACTER_WIDTH, ANNOTATION_LINE_HEIGHT, ANNOTATION_PADDING, GROUP_PADDING, EXTERNAL_LABEL_WIDTH, EXTERNAL_LABEL_LINE_HEIGHT, EXTERNAL_LABEL_HORIZONTAL_PADDING, EXTERNAL_LABEL_CHARACTER_WIDTH, EXTERNAL_LABEL_UPPERCASE_WIDTH, EXTERNAL_LABEL_WIDE_CHARACTER_WIDTH, EXTERNAL_LABEL_SPACE_WIDTH, EXTERNAL_LABEL_CLEARANCE, FLOW_LABEL_INDENT, MIN_PARTICIPANT_WIDTH, MIN_PARTICIPANT_HEIGHT, MIN_SUB_PROCESS_WIDTH, MIN_SUB_PROCESS_HEIGHT, SEMANTIC_BAND_HEIGHT, MIN_LANE_CONTENT_WIDTH, MIN_LANE_HEIGHT, BOUNDARY_EVENT_SPACING, ANNOTATION_MIN_HEIGHT, ANNOTATION_TARGET_ASPECT_RATIO, ANNOTATION_ASPECT_RATIO_PENALTY_SCALE, MAX_ARTIFACT_SEARCH_OFFSET, MAX_ARTIFACT_GAP_STEPS, NON_STRAIGHT_ARTIFACT_ASSOCIATION_PENALTY, BOUNDARY_EVENT_ARTIFACT_CLEARANCE, EXPANDED_SUBPROCESS_ANNOTATION_CLEARANCE, EXPANDED_SUBPROCESS_LABEL_HEIGHT, EXPANDED_SUBPROCESS_LABEL_PADDING, MAX_LABEL_SEARCH_STEPS, MESSAGE_FLOW_SIDE_OFFSET, MESSAGE_FLOW_CHANNEL_SPACING, MESSAGE_FLOW_CHANNEL_WIDTH_DIVISOR, MAX_EXHAUSTIVE_PARTICIPANT_COUNT, MESSAGE_FLOW_OBSTACLE_INSET, MAX_ROUTE_SEARCH_ATTEMPTS, MAX_LOCAL_U_CHANNEL_ATTEMPTS, ROUTE_OBSTACLE_INSET, VISIBILITY_GRAPH_TURN_PENALTY, SEGMENT_INTERSECTION_EPSILON, EDGE_PRIORITY, CLEAR_DOCK_X_FRACTIONS, Layouter;
var init_dist6 = __esm({
  "node_modules/bpmn-auto-layout/dist/index.js"() {
    init_dist5();
    init_dist();
    DiFactory = class {
      constructor(moddle) {
        this.moddle = moddle;
      }
      create(type, attrs) {
        return this.moddle.create(type, attrs || {});
      }
      createDiBounds(bounds2) {
        return this.create("dc:Bounds", bounds2);
      }
      createDiLabel(bounds2) {
        return this.create("bpmndi:BPMNLabel", {
          bounds: this.createDiBounds(bounds2)
        });
      }
      createDiShape(semantic, bounds2, attrs) {
        return this.create("bpmndi:BPMNShape", assign({
          bpmnElement: semantic,
          bounds: this.createDiBounds(bounds2)
        }, attrs));
      }
      createDiWaypoints(waypoints) {
        var self = this;
        return map(waypoints, function(pos) {
          return self.createDiWaypoint(pos);
        });
      }
      createDiWaypoint(point2) {
        return this.create("dc:Point", pick(point2, ["x", "y"]));
      }
      createDiEdge(semantic, waypoints, attrs) {
        return this.create("bpmndi:BPMNEdge", assign({
          bpmnElement: semantic,
          waypoint: this.createDiWaypoints(waypoints)
        }, attrs));
      }
      createDiPlane(attrs) {
        return this.create("bpmndi:BPMNPlane", attrs);
      }
      createDiDiagram(attrs) {
        return this.create("bpmndi:BPMNDiagram", attrs);
      }
    };
    DEFAULT_TASK_HEIGHT = 80;
    DEFAULT_TASK_WIDTH = 100;
    LayoutError = class extends Error {
      constructor(code, elementId, message, relatedElementIds = []) {
        super(message);
        this.name = "LayoutError";
        this.code = code;
        this.elementId = elementId;
        this.relatedElementIds = relatedElementIds;
      }
    };
    LayoutWarning = class extends Error {
      constructor(code, elementId, message, relatedElementIds = []) {
        super(message);
        this.name = "LayoutWarning";
        this.code = code;
        this.elementId = elementId;
        this.relatedElementIds = relatedElementIds;
      }
    };
    HORIZONTAL_GAP = 100;
    VERTICAL_GAP = 80;
    OUTER_MARGIN = 80;
    SUB_PROCESS_PADDING = 40;
    ROUTING_MARGIN = 20;
    MESSAGE_FLOW_BEND_PENALTY = VERTICAL_GAP;
    PARTICIPANT_HEADER_WIDTH = 30;
    LANE_CONTENT_PADDING = 40;
    ANNOTATION_MIN_WIDTH = 100;
    ANNOTATION_MAX_WIDTH = 340;
    ANNOTATION_WIDTH_STEP = 40;
    ANNOTATION_CHARACTER_WIDTH = 7;
    ANNOTATION_LINE_HEIGHT = 14;
    ANNOTATION_PADDING = 10;
    GROUP_PADDING = 40;
    EXTERNAL_LABEL_WIDTH = 90;
    EXTERNAL_LABEL_LINE_HEIGHT = 14;
    EXTERNAL_LABEL_HORIZONTAL_PADDING = 2;
    EXTERNAL_LABEL_CHARACTER_WIDTH = 7;
    EXTERNAL_LABEL_UPPERCASE_WIDTH = 9;
    EXTERNAL_LABEL_WIDE_CHARACTER_WIDTH = 11;
    EXTERNAL_LABEL_SPACE_WIDTH = 4;
    EXTERNAL_LABEL_CLEARANCE = 5;
    FLOW_LABEL_INDENT = 15;
    MIN_PARTICIPANT_WIDTH = 300;
    MIN_PARTICIPANT_HEIGHT = 150;
    MIN_SUB_PROCESS_WIDTH = 140;
    MIN_SUB_PROCESS_HEIGHT = 120;
    SEMANTIC_BAND_HEIGHT = 80;
    MIN_LANE_CONTENT_WIDTH = 300;
    MIN_LANE_HEIGHT = 60;
    BOUNDARY_EVENT_SPACING = 8;
    ANNOTATION_MIN_HEIGHT = 40;
    ANNOTATION_TARGET_ASPECT_RATIO = 3;
    ANNOTATION_ASPECT_RATIO_PENALTY_SCALE = 100;
    MAX_ARTIFACT_SEARCH_OFFSET = 400;
    MAX_ARTIFACT_GAP_STEPS = 4;
    NON_STRAIGHT_ARTIFACT_ASSOCIATION_PENALTY = VERTICAL_GAP;
    BOUNDARY_EVENT_ARTIFACT_CLEARANCE = 3 * ROUTING_MARGIN;
    EXPANDED_SUBPROCESS_ANNOTATION_CLEARANCE = 2 * ROUTING_MARGIN;
    EXPANDED_SUBPROCESS_LABEL_HEIGHT = 28;
    EXPANDED_SUBPROCESS_LABEL_PADDING = 7;
    MAX_LABEL_SEARCH_STEPS = 100;
    MESSAGE_FLOW_SIDE_OFFSET = 10;
    MESSAGE_FLOW_CHANNEL_SPACING = 10;
    MESSAGE_FLOW_CHANNEL_WIDTH_DIVISOR = 4;
    MAX_EXHAUSTIVE_PARTICIPANT_COUNT = 8;
    MESSAGE_FLOW_OBSTACLE_INSET = 1;
    MAX_ROUTE_SEARCH_ATTEMPTS = 100;
    MAX_LOCAL_U_CHANNEL_ATTEMPTS = 20;
    ROUTE_OBSTACLE_INSET = 1;
    VISIBILITY_GRAPH_TURN_PENALTY = 1;
    SEGMENT_INTERSECTION_EPSILON = 1e-6;
    EDGE_PRIORITY = {
      SPINE: 0,
      STRAIGHT: 1,
      CROSS_BAND_GATEWAY_BRANCH: 2,
      STANDARD: 3,
      BACK_EDGE: 4
    };
    CLEAR_DOCK_X_FRACTIONS = [0.5, 0.25, 0.75];
    Layouter = class {
      constructor() {
        this.moddle = new SimpleBpmnModdle();
        this.diFactory = new DiFactory(this.moddle);
        this.expandedIds = /* @__PURE__ */ new Set();
        this.warnings = [];
      }
      async layoutProcess(xml3) {
        this.warnings = [];
        const parsed = await this.moddle.fromXML(xml3);
        const definitions = parsed.rootElement;
        validateParseWarnings(parsed.warnings || [], xml3);
        const root = this.selectRoot(definitions);
        if (!root) {
          return {
            xml: (await this.moddle.toXML(definitions, { format: true })).xml,
            warnings: this.warnings
          };
        }
        this.expandedIds = getExpandedIds(definitions, root);
        validateInputVisuals(definitions, root);
        definitions.diagrams = [];
        const layout = is(root, "bpmn:Collaboration") ? this.layoutCollaboration(root) : this.layoutScope(root);
        normalizeLayout(layout);
        this.emitDiagram(definitions, root, layout);
        this.emitCollapsedSubProcessDiagrams(definitions, layout);
        this.warnForMissingDi(root, definitions);
        return {
          xml: (await this.moddle.toXML(definitions, { format: true })).xml,
          warnings: this.warnings
        };
      }
      selectRoot(definitions) {
        const roots = definitions.rootElements || [];
        const collaboration = roots.find((element) => is(element, "bpmn:Collaboration"));
        if (collaboration) {
          const participants = collaboration.participants || [];
          if (!participants.some((participant) => participant.processRef)) {
            const invalidParticipant = participants.find((participant) => participant.$attrs.processRef);
            if (invalidParticipant) {
              throw new LayoutError(
                "INVALID_PARTICIPANT_PROCESS_REFERENCE",
                invalidParticipant.id,
                "A participant processRef must reference a declared process."
              );
            }
            throw new LayoutError(
              "UNSUPPORTED_COLLABORATION",
              collaboration.id,
              "A collaboration needs at least one participant with a processRef."
            );
          }
          return collaboration;
        }
        return roots.find((element) => is(element, "bpmn:Process")) || null;
      }
      layoutCollaboration(collaboration) {
        validateMessageFlows(collaboration.messageFlows || []);
        const layout = createLayout(collaboration);
        const messageFlowEndpointDirections = /* @__PURE__ */ new Map();
        const addMessageFlowDirection = (element, direction) => {
          if (!messageFlowEndpointDirections.has(element)) {
            messageFlowEndpointDirections.set(element, /* @__PURE__ */ new Set());
          }
          messageFlowEndpointDirections.get(element).add(direction);
        };
        for (const messageFlow of collaboration.messageFlows || []) {
          addMessageFlowDirection(messageFlow.sourceRef, "outgoing");
          addMessageFlowDirection(messageFlow.targetRef, "incoming");
        }
        const participantLayouts = /* @__PURE__ */ new Map();
        const anchorPositionedParticipants = /* @__PURE__ */ new Set();
        const expandableParticipants = /* @__PURE__ */ new Set();
        let nextParticipantY = 0;
        for (const participant of collaboration.participants || []) {
          const process = participant.processRef;
          if (!process) {
            const size = getDefaultSize(participant);
            layout.shapes.set(participant, bounds(0, 0, size.width, size.height));
            anchorPositionedParticipants.add(participant);
            expandableParticipants.add(participant);
            continue;
          }
          const processLayout = this.layoutScope(
            process,
            true,
            messageFlowEndpointDirections
          );
          const participantRect = this.getParticipantContainerBounds(process, processLayout);
          const dx = -participantRect.x;
          const dy = -participantRect.y;
          translateLayout(processLayout, dx, dy);
          layout.shapes.set(participant, bounds(
            0,
            0,
            participantRect.width,
            participantRect.height
          ));
          participantLayouts.set(participant, processLayout);
          if (!hasParticipantContent(processLayout)) {
            anchorPositionedParticipants.add(participant);
            expandableParticipants.add(participant);
          }
          processLayout.emitInParent = true;
          layout.children.push(processLayout);
        }
        const localCollaborationShapes = new Map([
          ...layout.shapes,
          ...getExpandedChildShapes(layout)
        ]);
        const messageFlowChannelOffsets = assignMessageFlowChannelOffsets(
          collaboration,
          localCollaborationShapes
        );
        sizeAndPositionParticipantsFromMessageAnchors(
          collaboration,
          layout.shapes,
          localCollaborationShapes,
          messageFlowChannelOffsets,
          anchorPositionedParticipants,
          expandableParticipants
        );
        const participantOrder = orderParticipantsByMessageFlow(
          collaboration,
          layout.shapes,
          localCollaborationShapes
        );
        for (const participant of participantOrder) {
          const participantBounds = layout.shapes.get(participant);
          const processLayout = participantLayouts.get(participant);
          if (processLayout) {
            const extents = getExtents(processLayout);
            const footprintTop = Math.min(0, extents.minY);
            const footprintBottom = Math.max(participantBounds.height, extents.maxY);
            const participantY = nextParticipantY - footprintTop;
            participantBounds.y = participantY;
            translateLayout(processLayout, 0, participantY);
            nextParticipantY += footprintBottom - footprintTop + VERTICAL_GAP;
          } else {
            participantBounds.y = nextParticipantY;
            nextParticipantY += participantBounds.height + VERTICAL_GAP;
          }
        }
        let collaborationShapes = new Map([
          ...layout.shapes,
          ...getExpandedChildShapes(layout)
        ]);
        const participantPositions = alignParticipantsHorizontally(
          collaboration,
          layout.shapes,
          collaborationShapes,
          getExpandedChildEdges(layout),
          messageFlowChannelOffsets,
          anchorPositionedParticipants,
          expandableParticipants
        );
        for (const [participant, x] of participantPositions) {
          const participantBounds = layout.shapes.get(participant);
          const processLayout = participantLayouts.get(participant);
          const dx = x - participantBounds.x;
          participantBounds.x = x;
          if (processLayout) {
            translateLayout(processLayout, dx, 0);
          }
        }
        collaborationShapes = new Map([
          ...layout.shapes,
          ...getExpandedChildShapes(layout)
        ]);
        sizeAndPositionParticipantsFromMessageAnchors(
          collaboration,
          layout.shapes,
          collaborationShapes,
          messageFlowChannelOffsets,
          anchorPositionedParticipants,
          expandableParticipants
        );
        for (const [participant, dx] of alignParticipantComponentsLeft(
          collaboration,
          layout.shapes
        )) {
          const participantBounds = layout.shapes.get(participant);
          const processLayout = participantLayouts.get(participant);
          participantBounds.x += dx;
          if (processLayout) {
            translateLayout(processLayout, dx, 0);
          }
        }
        compactParticipantRows(
          participantOrder,
          layout.shapes,
          participantLayouts
        );
        collaborationShapes = new Map([
          ...layout.shapes,
          ...getExpandedChildShapes(layout)
        ]);
        const messageObstacles = getMessageObstacles(collaborationShapes);
        let participantBoundsChanged;
        do {
          const routes = routeMessageFlows(
            collaboration,
            layout.shapes,
            collaborationShapes,
            messageObstacles,
            messageFlowChannelOffsets
          );
          for (const [messageFlow, points] of routes) {
            layout.edges.set(messageFlow, points);
          }
          participantBoundsChanged = includeResizableParticipantMessageDocks(
            collaboration,
            layout.shapes,
            layout.edges,
            expandableParticipants
          );
        } while (participantBoundsChanged);
        const artifacts = collaboration.artifacts || [];
        const groups = artifacts.filter((element) => is(element, "bpmn:Group"));
        const artifactRecords = artifacts.filter((element) => isArtifact(element) && !is(element, "bpmn:Group")).map((element, index) => this.createRecord(element, index));
        const associations2 = artifacts.filter((element) => is(element, "bpmn:Association"));
        this.placeArtifacts(
          artifactRecords,
          associations2,
          layout,
          [],
          /* @__PURE__ */ new Set(),
          collaboration.participants.length === 1,
          collaboration.participants.length !== 1
        );
        this.warnings.push(...layoutGroups(groups, layout));
        return layout;
      }
      layoutScope(scope, participantProcess = false, messageFlowEndpointDirections = /* @__PURE__ */ new Map()) {
        const layout = createLayout(scope);
        const flowElements = scope.flowElements || [];
        const artifacts = scope.artifacts || [];
        const groups = artifacts.filter((element) => is(element, "bpmn:Group"));
        const sequenceFlows = flowElements.filter((element) => is(element, "bpmn:SequenceFlow"));
        const dataAssociations = flowElements.flatMap((element) => [
          ...element.dataInputAssociations || [],
          ...element.dataOutputAssociations || []
        ]);
        const associations2 = [...flowElements, ...artifacts].filter((element) => is(element, "bpmn:Association")).concat(dataAssociations);
        const nodeElements = [.../* @__PURE__ */ new Set([
          ...flowElements.filter((element) => {
            return !is(element, "bpmn:SequenceFlow") && !is(element, "bpmn:Association") && !is(element, "bpmn:Group") && !is(element, "bpmn:DataObject");
          }),
          ...artifacts.filter((element) => {
            return isArtifact(element) && !is(element, "bpmn:Group");
          })
        ])];
        const records = nodeElements.map((element, index) => this.createRecord(element, index));
        const recordsByElement = new Map(records.map((record) => [record.element, record]));
        for (const record of records) {
          if (!is(record.element, "bpmn:SubProcess")) {
            continue;
          }
          record.child = this.layoutScope(
            record.element,
            false,
            messageFlowEndpointDirections
          );
          if (record.expanded) {
            const childExtents = getExtents(record.child);
            record.size = {
              width: Math.max(MIN_SUB_PROCESS_WIDTH, childExtents.width + 2 * SUB_PROCESS_PADDING),
              height: Math.max(MIN_SUB_PROCESS_HEIGHT, childExtents.height + 2 * SUB_PROCESS_PADDING)
            };
          }
          layout.children.push(record.child);
        }
        validateSequenceFlows(sequenceFlows, recordsByElement, scope);
        validateBoundaryEvents(records, recordsByElement, scope);
        validateLinks(records, scope);
        const graphRecords = records.filter((record) => !record.isBoundary && !record.isArtifact && !(is(record.element, "bpmn:SubProcess") && record.element.triggeredByEvent));
        const graphSet = new Set(graphRecords.map((record) => record.element));
        const graphEdges = sequenceFlows.filter((flow) => graphSet.has(flow.sourceRef) && graphSet.has(flow.targetRef));
        const boundaryEdges = sequenceFlows.filter((flow) => is(flow.sourceRef, "bpmn:BoundaryEvent"));
        const policy = createSemanticPolicy(scope, graphRecords, graphEdges, boundaryEdges, records);
        const ranks = assignRanks(graphRecords, graphEdges, boundaryEdges, policy);
        policy.backEdges = ranks.backEdges;
        compactSemanticBands(graphRecords, graphEdges, boundaryEdges, ranks, policy);
        placeRecords(graphRecords, ranks, policy);
        clearBoundaryHandlerExits(graphRecords, boundaryEdges, recordsByElement, policy);
        packComponents(scope, graphRecords, graphEdges, boundaryEdges);
        applyLaneMembership(scope, graphRecords, graphEdges, policy, layout);
        placeBoundaryEvents(records, recordsByElement);
        for (const record of graphRecords) {
          layout.shapes.set(record.element, record.bounds);
        }
        for (const record of records.filter((record2) => record2.isBoundary)) {
          layout.shapes.set(record.element, record.bounds);
        }
        this.placeExpandedChildren(records, layout);
        this.routeSequenceFlows(sequenceFlows, layout, policy);
        this.placeEventSubProcesses(records, layout);
        if (participantProcess) {
          const interiorArtifacts = records.filter((record) => {
            return record.isArtifact && !isExteriorArtifact(record.element);
          });
          const exteriorArtifacts = records.filter((record) => {
            return record.isArtifact && isExteriorArtifact(record.element);
          });
          this.placeArtifacts(
            interiorArtifacts,
            associations2,
            layout,
            [],
            messageFlowEndpointDirections
          );
          const participantBounds = this.getParticipantContainerBounds(scope, layout);
          this.placeArtifacts(exteriorArtifacts, associations2, layout, [{
            rect: participantBounds,
            containsOwner: true,
            participant: true
          }], messageFlowEndpointDirections);
        } else {
          this.placeArtifacts(
            records,
            associations2,
            layout,
            [],
            messageFlowEndpointDirections
          );
        }
        this.warnings.push(...layoutGroups(groups, layout));
        return layout;
      }
      createRecord(element, index) {
        const size = getDefaultSize(element);
        if (!size || !isSupportedVisualElement(element)) {
          throw new LayoutError(
            "UNSUPPORTED_ELEMENT",
            element.id,
            `Cannot generate DI for visual BPMN element "${element.$type}".`
          );
        }
        return {
          element,
          index,
          size,
          isBoundary: is(element, "bpmn:BoundaryEvent"),
          isArtifact: isArtifact(element),
          expanded: is(element, "bpmn:SubProcess") && this.expandedIds.has(element.id),
          child: null
        };
      }
      getParticipantContainerBounds(process, layout) {
        const extents = getParticipantContentExtents(layout);
        const hasLanes = flattenLanes(process.laneSets || []).length > 0;
        const leadingPadding = hasLanes ? PARTICIPANT_HEADER_WIDTH : PARTICIPANT_HEADER_WIDTH + SUB_PROCESS_PADDING;
        const trailingPadding = hasLanes ? 0 : SUB_PROCESS_PADDING;
        const verticalPadding = hasLanes ? 0 : SUB_PROCESS_PADDING;
        const width = Math.max(
          MIN_PARTICIPANT_WIDTH,
          extents.width + leadingPadding + trailingPadding
        );
        const height = Math.max(
          MIN_PARTICIPANT_HEIGHT,
          extents.height + 2 * verticalPadding
        );
        return bounds(
          extents.minX - leadingPadding,
          extents.minY - verticalPadding,
          width,
          height
        );
      }
      placeExpandedChildren(records) {
        for (const record of records) {
          if (!record.expanded || !record.child || !record.bounds) {
            continue;
          }
          const extents = getExtents(record.child);
          translateLayout(
            record.child,
            record.bounds.x + SUB_PROCESS_PADDING - extents.minX,
            record.bounds.y + SUB_PROCESS_PADDING - extents.minY
          );
          record.child.emitInParent = true;
          if (needsExpandedSubProcessTitleClearance(
            record.element,
            record.bounds,
            record.child
          )) {
            translateLayout(record.child, 0, EXPANDED_SUBPROCESS_LABEL_HEIGHT);
          }
        }
      }
      placeEventSubProcesses(records, layout) {
        const eventSubProcesses = records.filter((record) => {
          return is(record.element, "bpmn:SubProcess") && record.element.triggeredByEvent;
        });
        if (!eventSubProcesses.length) {
          return;
        }
        let nextEventSubProcessY = getExtents(layout).maxY + VERTICAL_GAP;
        for (const record of eventSubProcesses) {
          if (!record.expanded) {
            record.bounds = bounds(0, nextEventSubProcessY, record.size.width, record.size.height);
            layout.shapes.set(record.element, record.bounds);
            nextEventSubProcessY += record.size.height + VERTICAL_GAP;
            continue;
          }
          const extents = getExtents(record.child);
          const width = Math.max(MIN_SUB_PROCESS_WIDTH, extents.width + 2 * SUB_PROCESS_PADDING);
          const height = Math.max(MIN_SUB_PROCESS_HEIGHT, extents.height + 2 * SUB_PROCESS_PADDING);
          record.bounds = bounds(0, nextEventSubProcessY, width, height);
          layout.shapes.set(record.element, record.bounds);
          translateLayout(
            record.child,
            record.bounds.x + SUB_PROCESS_PADDING - extents.minX,
            record.bounds.y + SUB_PROCESS_PADDING - extents.minY
          );
          record.child.emitInParent = true;
          nextEventSubProcessY += height + VERTICAL_GAP;
        }
      }
      placeArtifacts(records, associations2, layout, additionalBoundaryContainers = [], reservedVerticalEndpointDirections = /* @__PURE__ */ new Map(), avoidParticipantInterior = false, preferParticipantSides = true) {
        const artifactRecords = records.filter((record) => record.isArtifact);
        const graphShapes = new Map([
          ...layout.shapes,
          ...getExpandedChildShapes(layout)
        ]);
        const graphElements = new Set(graphShapes.keys());
        const owners = /* @__PURE__ */ new Map();
        const graphObstacles = [...graphShapes.entries()].filter(([element]) => {
          return !is(element, "bpmn:Lane") && !is(element, "bpmn:Participant") && !isArtifact(element);
        }).map(([element, rect]) => ({ element, rect }));
        const graphExtents = getShapeExtents(graphObstacles);
        const placementExtents = getShapeExtents([...graphShapes.entries()].filter(([element]) => !isArtifact(element)).map(([element, rect]) => ({ element, rect })));
        const currentArtifacts = new Set(artifactRecords.map((record) => record.element));
        const annotatedMessageEndpoints = /* @__PURE__ */ new Map();
        for (const association of associations2) {
          const endpoints = [
            ...Array.isArray(association.sourceRef) ? association.sourceRef : [association.sourceRef],
            association.targetRef
          ];
          const annotation = endpoints.find((endpoint) => {
            return currentArtifacts.has(endpoint) && is(endpoint, "bpmn:TextAnnotation");
          });
          const owner = endpoints.find((endpoint) => endpoint !== annotation);
          if (annotation && reservedVerticalEndpointDirections.has(owner)) {
            annotatedMessageEndpoints.set(
              owner,
              reservedVerticalEndpointDirections.get(owner)
            );
          }
        }
        const graphRoutes = [
          ...layout.edges.entries(),
          ...getExpandedChildEdges(layout)
        ].filter(([element]) => {
          return is(element, "bpmn:SequenceFlow") || is(element, "bpmn:MessageFlow");
        }).map(([element, points]) => ({ element, points }));
        const reservedRoutes = [...annotatedMessageEndpoints].flatMap(([
          element,
          directions
        ]) => {
          const rect = graphShapes.get(element);
          if (!rect) {
            return [];
          }
          const centerX = rect.x + rect.width / 2;
          return [
            directions.has("incoming") && {
              element,
              points: [
                { x: centerX, y: rect.y },
                { x: centerX, y: rect.y - MAX_ARTIFACT_SEARCH_OFFSET }
              ]
            },
            directions.has("outgoing") && {
              element,
              points: [
                { x: centerX, y: rect.y + rect.height },
                {
                  x: centerX,
                  y: rect.y + rect.height + MAX_ARTIFACT_SEARCH_OFFSET
                }
              ]
            }
          ].filter(Boolean);
        });
        graphRoutes.push(...reservedRoutes);
        graphRoutes.push(...reservedRoutes);
        const placedArtifacts = [...graphShapes.entries()].filter(([element]) => {
          return isArtifact(element) && !currentArtifacts.has(element);
        }).map(([element, rect]) => ({
          element,
          rect,
          annotationClearance: 0
        }));
        for (const association of associations2) {
          const endpoints = [
            ...Array.isArray(association.sourceRef) ? association.sourceRef : [association.sourceRef],
            association.targetRef
          ];
          const artifact = endpoints.find((endpoint) => artifactRecords.some((record) => record.element === endpoint));
          const owner = is(association, "bpmn:DataAssociation") ? association.$parent : endpoints.find((endpoint) => endpoint !== artifact && graphElements.has(endpoint));
          if (!artifact || !owner || !graphElements.has(owner)) {
            continue;
          }
          if (!owners.has(artifact)) {
            owners.set(artifact, []);
          }
          owners.get(artifact).push({
            association,
            owner,
            ownerBounds: graphShapes.get(owner)
          });
        }
        for (const references of owners.values()) {
          const counts = /* @__PURE__ */ new Map();
          const indices = /* @__PURE__ */ new Map();
          for (const reference of references) {
            counts.set(reference.owner, (counts.get(reference.owner) || 0) + 1);
          }
          for (const reference of references) {
            const index = indices.get(reference.owner) || 0;
            reference.ownerConnectionIndex = index;
            reference.ownerConnectionCount = counts.get(reference.owner);
            indices.set(reference.owner, index + 1);
          }
        }
        artifactRecords.sort((a, b) => {
          const aReferences = owners.get(a.element)?.length || 0;
          const bReferences = owners.get(b.element)?.length || 0;
          const aArea = artifactSizeCandidates(a.element)[0];
          const bArea = artifactSizeCandidates(b.element)[0];
          return bReferences - aReferences || bArea.width * bArea.height - aArea.width * aArea.height || a.index - b.index;
        });
        for (const record of artifactRecords) {
          const references = owners.get(record.element) || [];
          const ownerBounds = references.length ? graphShapes.get(references[0].owner) : null;
          const owner = references[0]?.owner;
          const enclosingSubProcesses = ownerBounds ? [...graphShapes.entries()].filter(([element, rect]) => {
            const centerX = ownerBounds.x + ownerBounds.width / 2;
            const centerY = ownerBounds.y + ownerBounds.height / 2;
            return element !== owner && is(element, "bpmn:SubProcess") && centerX >= rect.x && centerX <= rect.x + rect.width && centerY >= rect.y && centerY <= rect.y + rect.height;
          }) : [];
          const subProcessContainer = enclosingSubProcesses.map(([, rect]) => rect).sort((a, b) => a.width * a.height - b.width * b.height)[0];
          const containingContainers = ownerBounds ? findContainingArtifactContainers(ownerBounds, graphShapes) : [];
          const container = containingContainers[0];
          const boundaryContainers = [
            ...additionalBoundaryContainers,
            ...[...graphShapes.entries()].filter(([element]) => {
              return is(element, "bpmn:Lane") || is(element, "bpmn:Participant") || is(element, "bpmn:SubProcess");
            }).map(([element, rect]) => ({
              rect,
              containsOwner: containingContainers.includes(rect),
              participant: is(element, "bpmn:Participant")
            }))
          ];
          const processContainer = subProcessContainer || (!container && isExteriorArtifact(record.element) ? bounds(
            graphExtents.minX - SUB_PROCESS_PADDING,
            graphExtents.minY - SUB_PROCESS_PADDING,
            graphExtents.width + 2 * SUB_PROCESS_PADDING,
            graphExtents.height + 2 * SUB_PROCESS_PADDING
          ) : null);
          const annotationClearance = subProcessContainer && is(record.element, "bpmn:TextAnnotation") ? EXPANDED_SUBPROCESS_ANNOTATION_CLEARANCE : 0;
          const obstacles = graphObstacles.filter(({ element }) => {
            return !enclosingSubProcesses.some(([subProcess]) => subProcess === element);
          });
          record.associationObstacles = obstacles;
          const placement = findArtifactPlacement(
            record.element,
            ownerBounds,
            references,
            artifactSizeCandidates(record.element),
            obstacles,
            graphRoutes,
            placedArtifacts,
            container,
            processContainer,
            placementExtents,
            annotationClearance,
            boundaryContainers,
            avoidParticipantInterior,
            preferParticipantSides,
            isExteriorArtifact(record.element) && references.some(({ owner: owner2 }) => {
              return reservedVerticalEndpointDirections.has(owner2);
            }) ? VERTICAL_GAP : 0
          );
          record.size = { width: placement.width, height: placement.height };
          layout.shapes.set(record.element, placement);
          placedArtifacts.push({
            element: record.element,
            rect: placement,
            annotationClearance
          });
        }
        for (const record of artifactRecords) {
          const artifactBounds = layout.shapes.get(record.element);
          const references = owners.get(record.element) || [];
          for (const {
            association,
            owner,
            ownerConnectionIndex,
            ownerConnectionCount
          } of references) {
            layout.edges.set(association, routeArtifactAssociation(
              association,
              owner,
              graphShapes.get(owner),
              record.element,
              artifactBounds,
              ownerConnectionIndex,
              ownerConnectionCount,
              record.associationObstacles,
              graphRoutes
            ));
          }
        }
      }
      routeSequenceFlows(sequenceFlows, layout, policy) {
        const routedConnections = [];
        const shapes = [...layout.shapes.entries(), ...getExpandedChildShapes(layout)].filter(([element]) => {
          return !is(element, "bpmn:Lane") && !is(element, "bpmn:Participant") && !isArtifact(element);
        }).map(([element, rect]) => ({ element, rect }));
        const ordered = [...sequenceFlows].sort((a, b) => {
          return edgePriority(a, policy) - edgePriority(b, policy) || policy.edgeOrder.get(a) - policy.edgeOrder.get(b);
        });
        for (const flow of ordered) {
          const source = layout.shapes.get(flow.sourceRef);
          const target = layout.shapes.get(flow.targetRef);
          if (!source || !target) {
            continue;
          }
          const points = routeConnection(flow, source, target, shapes, routedConnections, policy);
          layout.edges.set(flow, points);
          routedConnections.push({ flow, points });
        }
      }
      emitDiagram(definitions, root, layout) {
        const plane = this.diFactory.createDiPlane({
          id: `BPMNPlane_${root.id}`,
          bpmnElement: root,
          planeElement: []
        });
        const diagram = this.diFactory.createDiDiagram({
          id: `BPMNDiagram_${root.id}`,
          plane
        });
        definitions.diagrams.push(diagram);
        emitLayout(this.diFactory, layout, plane.planeElement);
        orientPlaneDockings(this.diFactory, plane.planeElement);
        layoutExternalLabels(this.diFactory, plane.planeElement);
      }
      emitCollapsedSubProcessDiagrams(definitions, layout) {
        for (const child of layout.children) {
          if (child.emitInParent) {
            this.emitCollapsedSubProcessDiagrams(definitions, child);
            continue;
          }
          normalizeLayout(child);
          const plane = this.diFactory.createDiPlane({
            id: `BPMNPlane_${child.scope.id}`,
            bpmnElement: child.scope,
            planeElement: []
          });
          const diagram = this.diFactory.createDiDiagram({
            id: `BPMNDiagram_${child.scope.id}`,
            plane
          });
          definitions.diagrams.push(diagram);
          emitLayout(this.diFactory, child, plane.planeElement);
          layoutExternalLabels(this.diFactory, plane.planeElement);
          this.emitCollapsedSubProcessDiagrams(definitions, child);
        }
      }
      warnForMissingDi(root, definitions) {
        const shapeElements = /* @__PURE__ */ new Set();
        const edgeElements = /* @__PURE__ */ new Set();
        for (const diagram of definitions.diagrams) {
          for (const di of diagram.plane.planeElement) {
            if (di.$instanceOf("bpmndi:BPMNShape")) {
              shapeElements.add(di.bpmnElement);
            } else if (di.$instanceOf("bpmndi:BPMNEdge")) {
              edgeElements.add(di.bpmnElement);
            }
          }
        }
        for (const element of getExpectedDiElements(root)) {
          const isShape = isSupportedVisualElement(element);
          const emitted = isShape ? shapeElements.has(element) : edgeElements.has(element);
          if (emitted || this.warnings.some((warning) => warning.elementId === element.id)) {
            continue;
          }
          this.warnings.push(new LayoutWarning(
            "DI_NOT_CREATED",
            element.id,
            `No BPMN DI was created for visual BPMN element "${element.$type}".`
          ));
        }
      }
    };
  }
});

// src/layout-thread.ts
import { parentPort, workerData } from "node:worker_threads";

// node_modules/@nanobpm/workflow/dist/layout.js
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
async function layoutBpmn(bpmnXml) {
  let layoutProcess2;
  try {
    ({ layoutProcess: layoutProcess2 } = await Promise.resolve().then(() => (init_dist6(), dist_exports)));
  } catch (cause) {
    if (!isRecord(cause) || cause.code !== "ERR_MODULE_NOT_FOUND") {
      throw cause;
    }
    throw new Error('layoutBpmn requires the optional peer dependency "bpmn-auto-layout". Install it to generate diagram layout: npm i bpmn-auto-layout', { cause });
  }
  const result = await layoutProcess2(bpmnXml);
  return typeof result === "string" ? result : result.xml;
}

// src/layout-thread.ts
var xml2 = await layoutBpmn(workerData.xml);
parentPort.postMessage(xml2);
