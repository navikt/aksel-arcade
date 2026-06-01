var previewEvidenceUtils = (() => {
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

  // src/services/previewEvidence.ts
  var previewEvidence_exports = {};
  __export(previewEvidence_exports, {
    MAX_PREVIEW_EVIDENCE_ELEMENTS: () => MAX_PREVIEW_EVIDENCE_ELEMENTS,
    PREVIEW_EVIDENCE_ROOT_SELECTOR: () => PREVIEW_EVIDENCE_ROOT_SELECTOR,
    collectPreviewEvidenceFromFrame: () => collectPreviewEvidenceFromFrame,
    registerPreviewEvidenceRequestHandler: () => registerPreviewEvidenceRequestHandler,
    requestPreviewEvidenceFromFrame: () => requestPreviewEvidenceFromFrame,
    serializePreviewEvidence: () => serializePreviewEvidence
  });
  var PREVIEW_EVIDENCE_ROOT_SELECTOR = "#root";
  var MAX_PREVIEW_EVIDENCE_ELEMENTS = 200;
  var MAX_PREVIEW_EVIDENCE_TEXT_LENGTH = 200;
  var MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH = 200;
  var MAX_PREVIEW_EVIDENCE_CLASS_NAMES = 30;
  var collectPreviewEvidenceFromFrame = (iframe) => {
    if (!iframe) {
      return createPreviewUnavailableFailure("Preview iframe is not mounted yet.");
    }
    let frameDocument = null;
    let frameWindow = null;
    try {
      frameDocument = iframe.contentDocument;
      frameWindow = iframe.contentWindow;
    } catch (error) {
      return createPreviewUnavailableFailure(
        `Preview iframe could not be read: ${getErrorMessage(error)}`
      );
    }
    if (!frameDocument || !frameWindow) {
      return createPreviewUnavailableFailure("Preview iframe document is not available yet.");
    }
    const root = frameDocument.querySelector(PREVIEW_EVIDENCE_ROOT_SELECTOR);
    if (!root) {
      return createPreviewUnavailableFailure("Preview root element was not found in the sandbox.");
    }
    return {
      ok: true,
      evidence: serializePreviewEvidence(root, frameWindow)
    };
  };
  var previewEvidenceRequestHandlers = /* @__PURE__ */ new WeakMap();
  var registerPreviewEvidenceRequestHandler = (iframe, handler) => {
    previewEvidenceRequestHandlers.set(iframe, handler);
    return () => {
      if (previewEvidenceRequestHandlers.get(iframe) === handler) {
        previewEvidenceRequestHandlers.delete(iframe);
      }
    };
  };
  var requestPreviewEvidenceFromFrame = (iframe) => {
    if (!iframe) {
      return Promise.resolve(createPreviewUnavailableFailure("Preview iframe is not mounted yet."));
    }
    const handler = previewEvidenceRequestHandlers.get(iframe);
    if (!handler) {
      return Promise.resolve(
        createPreviewUnavailableFailure("Preview iframe is not connected to the sandbox yet.")
      );
    }
    try {
      return handler();
    } catch (error) {
      return Promise.resolve(
        createPreviewUnavailableFailure(`Preview evidence request failed: ${getErrorMessage(error)}`)
      );
    }
  };
  var serializePreviewEvidence = (root, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const state = {
      capturedElementCount: 0,
      truncated: false
    };
    const tree = serializeElement(root, frameWindow, state);
    if (!tree) {
      throw new Error("Preview evidence root could not be serialized.");
    }
    return {
      frame: {
        rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
        viewport: {
          width: roundNumber(frameWindow.innerWidth),
          height: roundNumber(frameWindow.innerHeight),
          devicePixelRatio: roundNumber(frameWindow.devicePixelRatio || 1)
        },
        scroll: {
          x: roundNumber(frameWindow.scrollX),
          y: roundNumber(frameWindow.scrollY)
        },
        capturedElementCount: state.capturedElementCount,
        truncated: state.truncated
      },
      tree
    };
  };
  var serializeElement = (element, frameWindow, state) => {
    if (isExcludedElement(element)) {
      return null;
    }
    if (state.capturedElementCount >= MAX_PREVIEW_EVIDENCE_ELEMENTS) {
      state.truncated = true;
      return null;
    }
    state.capturedElementCount += 1;
    const children = [];
    for (const child of Array.from(element.children)) {
      const childEvidence = serializeElement(child, frameWindow, state);
      if (childEvidence) {
        children.push(childEvidence);
      }
    }
    const text = getDirectTextContent(element);
    const attributes = getAllowedAttributes(element);
    const classNames = getClassNames(element);
    return {
      tagName: element.tagName.toLowerCase(),
      ...text ? { text } : {},
      ...attributes ? { attributes } : {},
      ...classNames ? { classNames } : {},
      boundingBox: getBoundingBox(element),
      computedStyle: getSelectedComputedStyle(frameWindow.getComputedStyle(element)),
      ...children.length > 0 ? { children } : {}
    };
  };
  var isExcludedElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    return tagName === "script" || tagName === "style" || tagName === "template" || tagName === "noscript";
  };
  var getAllowedAttributes = (element) => {
    const attributes = Array.from(element.attributes).filter((attribute) => isAllowedAttributeName(attribute.name)).sort((left, right) => left.name.localeCompare(right.name)).map((attribute) => [
      attribute.name,
      truncateEvidenceValue(
        normalizeWhitespace(attribute.value),
        MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH
      )
    ]);
    if (attributes.length === 0) {
      return void 0;
    }
    return Object.fromEntries(attributes);
  };
  var isAllowedAttributeName = (name) => {
    const normalizedName = name.toLowerCase();
    if (normalizedName === "style" || normalizedName.startsWith("on") || normalizedName.startsWith("data-react") || normalizedName.startsWith("__react")) {
      return false;
    }
    return normalizedName === "id" || normalizedName === "role" || normalizedName === "title" || normalizedName.startsWith("aria-") || normalizedName.startsWith("data-");
  };
  var getClassNames = (element) => {
    const classNames = Array.from(element.classList).filter((className) => !className.toLowerCase().startsWith("react-")).sort((left, right) => left.localeCompare(right)).slice(0, MAX_PREVIEW_EVIDENCE_CLASS_NAMES);
    return classNames.length > 0 ? classNames : void 0;
  };
  var getDirectTextContent = (element) => {
    const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? "").join(" ");
    const normalizedText = normalizeWhitespace(text);
    return normalizedText ? truncateEvidenceValue(normalizedText, MAX_PREVIEW_EVIDENCE_TEXT_LENGTH) : void 0;
  };
  var getBoundingBox = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: roundNumber(rect.x),
      y: roundNumber(rect.y),
      width: roundNumber(rect.width),
      height: roundNumber(rect.height),
      top: roundNumber(rect.top),
      right: roundNumber(rect.right),
      bottom: roundNumber(rect.bottom),
      left: roundNumber(rect.left)
    };
  };
  var getSelectedComputedStyle = (style) => removeEmptyStyleValues({
    display: style.display,
    position: style.position,
    boxSizing: style.boxSizing,
    width: style.width,
    height: style.height,
    marginTop: style.marginTop,
    marginRight: style.marginRight,
    marginBottom: style.marginBottom,
    marginLeft: style.marginLeft,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    rowGap: style.rowGap,
    columnGap: style.columnGap,
    flexDirection: style.flexDirection,
    alignItems: style.alignItems,
    justifyContent: style.justifyContent,
    gridTemplateColumns: style.gridTemplateColumns,
    gridTemplateRows: style.gridTemplateRows,
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    borderTopWidth: style.borderTopWidth,
    borderRightWidth: style.borderRightWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderLeftWidth: style.borderLeftWidth,
    borderTopColor: style.borderTopColor,
    borderRightColor: style.borderRightColor,
    borderBottomColor: style.borderBottomColor,
    borderLeftColor: style.borderLeftColor,
    borderTopLeftRadius: style.borderTopLeftRadius,
    borderTopRightRadius: style.borderTopRightRadius,
    borderBottomRightRadius: style.borderBottomRightRadius,
    borderBottomLeftRadius: style.borderBottomLeftRadius
  });
  var removeEmptyStyleValues = (style) => Object.fromEntries(
    Object.entries(style).filter(([, value]) => Boolean(value))
  );
  var normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();
  var truncateEvidenceValue = (value, maxLength) => value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  var roundNumber = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  var createPreviewUnavailableFailure = (message) => ({
    ok: false,
    error: {
      code: "preview-unavailable",
      message
    }
  });
  var getErrorMessage = (error) => error instanceof Error ? error.message : "Unknown frame access error";
  return __toCommonJS(previewEvidence_exports);
})();
