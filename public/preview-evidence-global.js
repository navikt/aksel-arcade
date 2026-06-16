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
    capturePreviewEvidenceSnapshot: () => capturePreviewEvidenceSnapshot,
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
  var capturePreviewEvidenceSnapshot = (root, {
    layers,
    screenshotScope = "viewport",
    target,
    currentPageId = null
  } = {}, frameWindow = root.ownerDocument.defaultView ?? window) => {
    try {
      const evidence = serializePreviewEvidence(root, frameWindow);
      const normalizedLayers = layers ? [...layers] : [];
      const screenshotRequested = normalizedLayers.includes("screenshot");
      const screenshot = screenshotRequested ? createPreviewScreenshot(root, { screenshotScope, target }, frameWindow) : null;
      if (screenshotRequested && !screenshot) {
        return createPreviewCaptureFailure(
          "preview-unavailable",
          "Preview screenshot could not be captured."
        );
      }
      return {
        ok: true,
        evidence,
        ...screenshot ? { screenshot } : {},
        captureMeta: {
          currentPageId,
          screenshotScope,
          ...screenshot?.targetDescription ? { targetDescription: screenshot.targetDescription } : {}
        }
      };
    } catch (error) {
      const code = isTaggedPreviewCaptureError(error) ? error.code : "preview-unavailable";
      const message = getErrorMessage(error);
      return createPreviewCaptureFailure(
        code,
        code === "preview-unavailable" ? `Preview evidence could not be captured: ${message}` : message
      );
    }
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
  var createPreviewScreenshot = (root, {
    screenshotScope,
    target
  }, frameWindow) => {
    const captureRegion = resolvePreviewCaptureRegion(root, frameWindow, screenshotScope, target);
    if (!captureRegion) {
      return null;
    }
    const frameDocument = root.ownerDocument;
    const documentWidth = getCaptureDocumentWidth(root, frameWindow);
    const documentHeight = getCaptureDocumentHeight(root, frameWindow);
    const stage = frameDocument.createElement("div");
    stage.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    stage.style.width = `${documentWidth}px`;
    stage.style.height = `${documentHeight}px`;
    stage.style.overflow = "hidden";
    stage.style.boxSizing = "border-box";
    stage.style.backgroundColor = frameWindow.getComputedStyle(frameDocument.body).backgroundColor || "transparent";
    stage.style.transform = `translate(${-captureRegion.rect.x}px, ${-captureRegion.rect.y}px)`;
    stage.style.transformOrigin = "top left";
    const clonedRoot = cloneStyledElementTree(root, frameWindow);
    if (!clonedRoot) {
      return null;
    }
    stage.appendChild(clonedRoot);
    const serializedStage = new XMLSerializer().serializeToString(stage);
    const width = Math.max(1, roundNumber(captureRegion.rect.width));
    const height = Math.max(1, roundNumber(captureRegion.rect.height));
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
      serializedStage,
      "</foreignObject>",
      "</svg>"
    ].join("");
    return {
      mimeType: "image/svg+xml",
      text: svg,
      width,
      height,
      ...captureRegion.targetDescription ? { targetDescription: captureRegion.targetDescription } : {}
    };
  };
  var resolvePreviewCaptureRegion = (root, frameWindow, screenshotScope, target) => {
    switch (screenshotScope) {
      case "viewport":
        return {
          rect: {
            x: roundNumber(frameWindow.scrollX),
            y: roundNumber(frameWindow.scrollY),
            width: roundNumber(frameWindow.innerWidth),
            height: roundNumber(frameWindow.innerHeight)
          }
        };
      case "full_page":
        return {
          rect: {
            x: 0,
            y: 0,
            width: roundNumber(getCaptureDocumentWidth(root, frameWindow)),
            height: roundNumber(getCaptureDocumentHeight(root, frameWindow))
          }
        };
      case "region": {
        const resolvedTarget = resolvePreviewCaptureTarget(root, target);
        if (!resolvedTarget) {
          throw createTaggedPreviewCaptureError(
            "invalid-capture-target",
            "Preview region capture requires a preview-root selector or accessibility target that resolves inside the sandbox preview."
          );
        }
        const rect = resolvedTarget.element.getBoundingClientRect();
        return {
          rect: {
            x: roundNumber(rect.left + frameWindow.scrollX),
            y: roundNumber(rect.top + frameWindow.scrollY),
            width: roundNumber(rect.width),
            height: roundNumber(rect.height)
          },
          targetDescription: resolvedTarget.targetDescription
        };
      }
    }
  };
  var getCaptureDocumentWidth = (root, frameWindow) => {
    const document = root.ownerDocument;
    const rootRect = root.getBoundingClientRect();
    return Math.max(
      roundNumber(frameWindow.innerWidth),
      roundNumber(document.documentElement.scrollWidth),
      roundNumber(document.body.scrollWidth),
      roundNumber(rootRect.right + frameWindow.scrollX)
    );
  };
  var getCaptureDocumentHeight = (root, frameWindow) => {
    const document = root.ownerDocument;
    const rootRect = root.getBoundingClientRect();
    return Math.max(
      roundNumber(frameWindow.innerHeight),
      roundNumber(document.documentElement.scrollHeight),
      roundNumber(document.body.scrollHeight),
      roundNumber(rootRect.bottom + frameWindow.scrollY)
    );
  };
  var cloneStyledElementTree = (element, frameWindow) => {
    if (isExcludedElement(element)) {
      return null;
    }
    const clonedElement = element.cloneNode(false);
    inlineComputedStyles(element, clonedElement, frameWindow);
    syncClonedControlState(element, clonedElement);
    for (const childNode of Array.from(element.childNodes)) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        clonedElement.appendChild(
          element.ownerDocument.createTextNode(childNode.textContent ?? "")
        );
        continue;
      }
      if (childNode.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const clonedChild = cloneStyledElementTree(childNode, frameWindow);
      if (clonedChild) {
        clonedElement.appendChild(clonedChild);
      }
    }
    return clonedElement;
  };
  var inlineComputedStyles = (sourceElement, clonedElement, frameWindow) => {
    if (!(clonedElement instanceof HTMLElement) && !(clonedElement instanceof SVGElement)) {
      return;
    }
    const computedStyle = frameWindow.getComputedStyle(sourceElement);
    const styleTarget = clonedElement.style;
    for (const propertyName of Array.from(computedStyle)) {
      styleTarget.setProperty(
        propertyName,
        computedStyle.getPropertyValue(propertyName),
        computedStyle.getPropertyPriority(propertyName)
      );
    }
  };
  var syncClonedControlState = (sourceElement, clonedElement) => {
    if (sourceElement instanceof HTMLTextAreaElement && clonedElement instanceof HTMLTextAreaElement) {
      clonedElement.value = sourceElement.value;
      clonedElement.textContent = sourceElement.value;
      return;
    }
    if (sourceElement instanceof HTMLInputElement && clonedElement instanceof HTMLInputElement) {
      clonedElement.value = sourceElement.value;
      clonedElement.checked = sourceElement.checked;
      if (sourceElement.checked) {
        clonedElement.setAttribute("checked", "checked");
      } else {
        clonedElement.removeAttribute("checked");
      }
      return;
    }
    if (sourceElement instanceof HTMLSelectElement && clonedElement instanceof HTMLSelectElement) {
      clonedElement.value = sourceElement.value;
      const sourceOptions = Array.from(sourceElement.options);
      Array.from(clonedElement.options).forEach((option, index) => {
        option.selected = sourceOptions[index]?.selected ?? false;
      });
    }
  };
  var resolvePreviewCaptureTarget = (root, target) => {
    if (!target) {
      return null;
    }
    if (target.selector) {
      const element = root.querySelector(target.selector);
      if (!element || isExcludedElement(element)) {
        throw createTaggedPreviewCaptureError(
          "invalid-capture-target",
          `Preview region selector "${target.selector}" did not match a preview element.`
        );
      }
      return {
        element,
        targetDescription: `selector "${target.selector}"`
      };
    }
    const candidates = [root, ...Array.from(root.querySelectorAll("*"))];
    const normalizedRole = target.role?.toLowerCase();
    const normalizedName = normalizeComparableText(target.name);
    const normalizedText = normalizeComparableText(target.text);
    const normalizedLabel = normalizeComparableText(target.label);
    const matchingElement = candidates.find((candidate) => {
      if (isExcludedElement(candidate)) {
        return false;
      }
      if (normalizedRole && getElementRole(candidate) !== normalizedRole) {
        return false;
      }
      if (normalizedName && !getElementAccessibleName(candidate).includes(normalizedName)) {
        return false;
      }
      if (normalizedText && !getElementVisibleText(candidate).includes(normalizedText)) {
        return false;
      }
      if (normalizedLabel && !getElementLabelText(candidate).includes(normalizedLabel)) {
        return false;
      }
      return true;
    });
    if (!matchingElement) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Preview region accessibility target did not match a preview element."
      );
    }
    return {
      element: matchingElement,
      targetDescription: describePreviewCaptureTarget(target)
    };
  };
  var describePreviewCaptureTarget = (target) => [
    target.role ? `role=${target.role}` : null,
    target.name ? `name="${target.name}"` : null,
    target.text ? `text="${target.text}"` : null,
    target.label ? `label="${target.label}"` : null
  ].filter(Boolean).join(" ");
  var getElementRole = (element) => {
    const explicitRole = element.getAttribute("role");
    if (explicitRole) {
      return explicitRole.toLowerCase();
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a" && element.hasAttribute("href")) return "link";
    if (tagName === "textarea") return "textbox";
    if (tagName === "select") return "combobox";
    if (tagName === "option") return "option";
    if (tagName === "img") return "img";
    if (/^h[1-6]$/.test(tagName)) return "heading";
    if (tagName !== "input") return tagName;
    const input = element;
    switch (input.type) {
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      case "range":
        return "slider";
      case "button":
      case "submit":
      case "reset":
        return "button";
      default:
        return "textbox";
    }
  };
  var getElementAccessibleName = (element) => {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return normalizeComparableText(ariaLabel);
    }
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "").join(" ");
      if (text.trim()) {
        return normalizeComparableText(text);
      }
    }
    const labelText = getElementLabelText(element);
    if (labelText) {
      return labelText;
    }
    const title = element.getAttribute("title");
    if (title) {
      return normalizeComparableText(title);
    }
    if (element instanceof HTMLInputElement && element.value) {
      return normalizeComparableText(element.value);
    }
    return getElementVisibleText(element);
  };
  var getElementLabelText = (element) => {
    if (!(element instanceof HTMLElement)) {
      return "";
    }
    const labels = isLabelableElement(element) ? Array.from(element.labels ?? []) : [];
    if (labels.length > 0) {
      return normalizeComparableText(labels.map((label) => label.textContent ?? "").join(" "));
    }
    if (element.id) {
      const label = Array.from(element.ownerDocument.querySelectorAll("label[for]")).find(
        (candidate) => candidate.getAttribute("for") === element.id
      );
      if (label) {
        return normalizeComparableText(label.textContent ?? "");
      }
    }
    const wrappingLabel = element.closest("label");
    return wrappingLabel ? normalizeComparableText(wrappingLabel.textContent ?? "") : "";
  };
  var getElementVisibleText = (element) => normalizeComparableText((element.textContent ?? "").replace(/\s+/g, " "));
  var normalizeComparableText = (value) => normalizeWhitespace(value ?? "").toLowerCase();
  var isLabelableElement = (element) => element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLMeterElement || element instanceof HTMLOutputElement || element instanceof HTMLProgressElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
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
  var createPreviewUnavailableFailure = (message) => createPreviewCaptureFailure("preview-unavailable", message);
  var createPreviewCaptureFailure = (code, message) => ({
    ok: false,
    error: {
      code,
      message
    }
  });
  var createTaggedPreviewCaptureError = (code, message) => Object.assign(new Error(message), { code });
  var isTaggedPreviewCaptureError = (error) => error instanceof Error && (() => {
    const errorWithCode = error;
    return errorWithCode.code !== void 0 && errorWithCode.code !== null && ["preview-unavailable", "invalid-capture-target", "render-timeout"].includes(
      String(errorWithCode.code)
    );
  })();
  var getErrorMessage = (error) => error instanceof Error ? error.message : "Unknown frame access error";
  return __toCommonJS(previewEvidence_exports);
})();
