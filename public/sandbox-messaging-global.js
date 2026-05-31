var sandboxMessaging = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // public/sandbox-messaging.js
  var sandbox_messaging_exports = {};
  __export(sandbox_messaging_exports, {
    getMessageTargetOrigin: () => getMessageTargetOrigin,
    isTrustedParentMessage: () => isTrustedParentMessage,
    postMessageToParent: () => postMessageToParent
  });
  var getMessageTargetOrigin = (location) => location.protocol === "file:" ? "*" : location.origin;
  var isTrustedParentMessage = (event, location, parentWindow) => {
    if (event.source !== parentWindow) {
      return false;
    }
    if (event.origin === location.origin) {
      return true;
    }
    return location.protocol === "file:" && event.origin === "null";
  };
  var postMessageToParent = (parentWindow, message, location) => {
    parentWindow.postMessage(message, getMessageTargetOrigin(location));
  };
  return __toCommonJS(sandbox_messaging_exports);
})();
