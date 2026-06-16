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
  var serializePreviewEvidence = (root, frameWindow = root.ownerDocument.defaultView ?? window, viewportFallback) => {
    const state = {
      capturedElementCount: 0,
      truncated: false
    };
    const tree = serializeElement(root, frameWindow, state);
    const viewport = getEffectiveViewportSize(frameWindow, viewportFallback);
    if (!tree) {
      throw new Error("Preview evidence root could not be serialized.");
    }
    return {
      frame: {
        rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
        viewport: { ...viewport, devicePixelRatio: roundNumber(frameWindow.devicePixelRatio || 1) },
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
  var serializePreviewAccessibility = (root, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const state = {
      nodeCount: 0,
      truncated: false
    };
    const nodes = serializeAccessibilityNodes(root, frameWindow, state);
    return {
      rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
      nodeCount: state.nodeCount,
      truncated: state.truncated,
      nodes
    };
  };
  var capturePreviewEvidenceSnapshot = (root, {
    layers,
    screenshotScope = "viewport",
    target,
    currentPageId = null,
    viewportFallback
  } = {}, frameWindow = root.ownerDocument.defaultView ?? window) => {
    try {
      const evidence = serializePreviewEvidence(root, frameWindow, viewportFallback);
      const normalizedLayers = layers ? [...layers] : [];
      const screenshotRequested = normalizedLayers.includes("screenshot");
      const accessibilityRequested = normalizedLayers.includes("accessibility");
      const screenshot = screenshotRequested ? createPreviewScreenshot(root, { screenshotScope, target, viewportFallback }, frameWindow) : null;
      const accessibility = accessibilityRequested ? serializePreviewAccessibility(root, frameWindow) : null;
      if (screenshotRequested && !screenshot) {
        return createPreviewCaptureFailure(
          "preview-unavailable",
          "Preview screenshot could not be captured."
        );
      }
      return {
        ok: true,
        evidence,
        ...accessibility ? { accessibility } : {},
        ...screenshot ? { screenshot } : {},
        captureMeta: {
          currentPageId,
          ...screenshotRequested ? { screenshotScope } : {},
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
  var serializeAccessibilityNodes = (element, frameWindow, state) => {
    if (isExcludedElement(element) || isAccessibilityHidden(element, frameWindow) || state.truncated) {
      return [];
    }
    const node = createAccessibilityNode(element);
    if (node) {
      if (state.nodeCount >= MAX_PREVIEW_EVIDENCE_ELEMENTS) {
        state.truncated = true;
        return [];
      }
      state.nodeCount += 1;
    }
    const children = [];
    for (const child of Array.from(element.children)) {
      if (state.truncated) {
        break;
      }
      children.push(...serializeAccessibilityNodes(child, frameWindow, state));
    }
    if (!node) {
      return children;
    }
    return [
      {
        ...node,
        ...children.length > 0 ? { children } : {}
      }
    ];
  };
  var createAccessibilityNode = (element) => {
    const explicitlyNamed = hasExplicitAccessibleName(element);
    const name = getElementAccessibleName(element);
    const role = getElementAccessibilityRole(element, explicitlyNamed);
    const focusable = isElementFocusable(element);
    const level = getElementHeadingLevel(element);
    const states = getElementAccessibilityStates(element);
    if (!role && !focusable && level === void 0 && states === void 0 && !explicitlyNamed) {
      return null;
    }
    return {
      role: role ?? "generic",
      ...name ? { name } : {},
      ...level !== void 0 ? { level } : {},
      ...focusable ? { focusable: true } : {},
      ...states ? { states } : {}
    };
  };
  var isExcludedElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    return tagName === "script" || tagName === "style" || tagName === "template" || tagName === "noscript";
  };
  var createPreviewScreenshot = (root, {
    screenshotScope,
    target,
    viewportFallback
  }, frameWindow) => {
    const captureRegion = resolvePreviewCaptureRegion(
      root,
      frameWindow,
      screenshotScope,
      target,
      viewportFallback
    );
    if (!captureRegion) {
      return null;
    }
    const frameDocument = root.ownerDocument;
    const documentWidth = getCaptureDocumentWidth(root, frameWindow, viewportFallback);
    const documentHeight = getCaptureDocumentHeight(root, frameWindow, viewportFallback);
    const stage = frameDocument.createElement("div");
    stage.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    stage.style.width = `${documentWidth}px`;
    stage.style.height = `${documentHeight}px`;
    stage.style.overflow = "hidden";
    stage.style.boxSizing = "border-box";
    stage.style.backgroundColor = resolvePreviewCanvasBackgroundColor(frameDocument, frameWindow);
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
  var resolvePreviewCaptureRegion = (root, frameWindow, screenshotScope, target, viewportFallback) => {
    switch (screenshotScope) {
      case "viewport": {
        const viewport = getEffectiveViewportSize(frameWindow, viewportFallback);
        return {
          rect: {
            x: roundNumber(frameWindow.scrollX),
            y: roundNumber(frameWindow.scrollY),
            width: viewport.width,
            height: viewport.height
          }
        };
      }
      case "full_page":
        return {
          rect: {
            x: 0,
            y: 0,
            width: roundNumber(getCaptureDocumentWidth(root, frameWindow, viewportFallback)),
            height: roundNumber(getCaptureDocumentHeight(root, frameWindow, viewportFallback))
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
  var getCaptureDocumentWidth = (root, frameWindow, viewportFallback) => {
    const document = root.ownerDocument;
    const rootRect = root.getBoundingClientRect();
    const viewport = getEffectiveViewportSize(frameWindow, viewportFallback);
    return Math.max(
      viewport.width,
      roundNumber(document.documentElement.scrollWidth),
      roundNumber(document.body.scrollWidth),
      roundNumber(rootRect.width),
      roundNumber(rootRect.right + frameWindow.scrollX)
    );
  };
  var getCaptureDocumentHeight = (root, frameWindow, viewportFallback) => {
    const document = root.ownerDocument;
    const rootRect = root.getBoundingClientRect();
    const viewport = getEffectiveViewportSize(frameWindow, viewportFallback);
    return Math.max(
      viewport.height,
      roundNumber(document.documentElement.scrollHeight),
      roundNumber(document.body.scrollHeight),
      roundNumber(rootRect.height),
      roundNumber(rootRect.bottom + frameWindow.scrollY)
    );
  };
  var resolvePreviewCanvasBackgroundColor = (frameDocument, frameWindow) => {
    const bodyColor = frameDocument.body ? frameWindow.getComputedStyle(frameDocument.body).backgroundColor : "";
    if (!isTransparentColor(bodyColor)) {
      return bodyColor;
    }
    const documentElementColor = frameWindow.getComputedStyle(frameDocument.documentElement).backgroundColor;
    if (!isTransparentColor(documentElementColor)) {
      return documentElementColor;
    }
    return bodyColor || documentElementColor || "transparent";
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
    const matchingCandidates = candidates.filter(
      (candidate) => matchesPreviewCaptureTargetCandidate(candidate, {
        normalizedRole,
        normalizedName,
        normalizedText,
        normalizedLabel
      })
    );
    const matchingElement = matchingCandidates.find(
      (candidate) => !matchingCandidates.some(
        (otherCandidate) => otherCandidate !== candidate && candidate.contains(otherCandidate)
      )
    ) ?? null;
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
  var matchesPreviewCaptureTargetCandidate = (candidate, {
    normalizedRole,
    normalizedName,
    normalizedText,
    normalizedLabel
  }) => {
    if (isExcludedElement(candidate)) {
      return false;
    }
    if (normalizedRole && getElementRole(candidate) !== normalizedRole) {
      return false;
    }
    if (normalizedName && !normalizeComparableText(getElementAccessibleName(candidate)).includes(normalizedName)) {
      return false;
    }
    if (normalizedText && !normalizeComparableText(getElementVisibleText(candidate)).includes(normalizedText)) {
      return false;
    }
    if (normalizedLabel && !normalizeComparableText(getElementLabelText(candidate)).includes(normalizedLabel)) {
      return false;
    }
    return true;
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
      return normalizeWhitespace(ariaLabel);
    }
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "").join(" ");
      if (text.trim()) {
        return normalizeWhitespace(text);
      }
    }
    const labelText = getElementLabelText(element);
    if (labelText) {
      return labelText;
    }
    const title = element.getAttribute("title");
    if (title) {
      return normalizeWhitespace(title);
    }
    if (element instanceof HTMLInputElement && element.value) {
      return normalizeWhitespace(element.value);
    }
    return getElementVisibleText(element);
  };
  var hasExplicitAccessibleName = (element) => element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title") || getElementLabelText(element).length > 0 || element instanceof HTMLInputElement && normalizeWhitespace(element.value).length > 0;
  var getElementLabelText = (element) => {
    if (!(element instanceof HTMLElement)) {
      return "";
    }
    if (!isLabelableElement(element)) {
      return "";
    }
    const labels = Array.from(element.labels ?? []);
    if (labels.length > 0) {
      return normalizeWhitespace(labels.map((label) => label.textContent ?? "").join(" "));
    }
    if (element.id) {
      const label = Array.from(element.ownerDocument.querySelectorAll("label[for]")).find(
        (candidate) => candidate.getAttribute("for") === element.id
      );
      if (label) {
        return normalizeWhitespace(label.textContent ?? "");
      }
    }
    const wrappingLabel = element.closest("label");
    return wrappingLabel ? normalizeWhitespace(wrappingLabel.textContent ?? "") : "";
  };
  var getElementVisibleText = (element) => normalizeWhitespace((element.textContent ?? "").replace(/\s+/g, " "));
  var normalizeComparableText = (value) => normalizeWhitespace(value ?? "").toLowerCase();
  var getElementAccessibilityRole = (element, explicitlyNamed) => {
    const explicitRole = element.getAttribute("role")?.trim().toLowerCase();
    if (explicitRole) {
      return explicitRole === "none" || explicitRole === "presentation" ? void 0 : explicitRole;
    }
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case "a":
        return element.hasAttribute("href") ? "link" : void 0;
      case "article":
        return "article";
      case "aside":
        return "complementary";
      case "button":
        return "button";
      case "dialog":
        return "dialog";
      case "footer":
        return "contentinfo";
      case "form":
        return explicitlyNamed ? "form" : void 0;
      case "header":
        return "banner";
      case "img":
        return "img";
      case "li":
        return "listitem";
      case "main":
        return "main";
      case "meter":
        return "meter";
      case "nav":
        return "navigation";
      case "ol":
      case "ul":
        return "list";
      case "option":
        return "option";
      case "progress":
        return "progressbar";
      case "section":
        return explicitlyNamed ? "region" : void 0;
      case "select":
        return element instanceof HTMLSelectElement && (element.multiple || element.size > 1) ? "listbox" : "combobox";
      case "summary":
        return "button";
      case "table":
        return "table";
      case "textarea":
        return "textbox";
      case "tr":
        return "row";
    }
    if (/^h[1-6]$/.test(tagName)) {
      return "heading";
    }
    if (tagName !== "input") {
      return void 0;
    }
    const input = element;
    switch (input.type) {
      case "button":
      case "submit":
      case "reset":
        return "button";
      case "checkbox":
        return "checkbox";
      case "hidden":
        return void 0;
      case "number":
        return "spinbutton";
      case "radio":
        return "radio";
      case "range":
        return "slider";
      case "search":
        return "searchbox";
      default:
        return "textbox";
    }
  };
  var getElementHeadingLevel = (element) => {
    const tagName = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      return Number(tagName.slice(1));
    }
    const role = element.getAttribute("role")?.trim().toLowerCase();
    if (role !== "heading") {
      return void 0;
    }
    const ariaLevel = Number(element.getAttribute("aria-level"));
    return Number.isInteger(ariaLevel) && ariaLevel > 0 ? ariaLevel : void 0;
  };
  var getElementAccessibilityStates = (element) => {
    const states = removeUndefinedAccessibilityStates({
      disabled: getElementDisabledState(element),
      selected: getElementSelectedState(element),
      expanded: getElementExpandedState(element),
      checked: getElementCheckedState(element),
      current: getElementCurrentState(element),
      pressed: getElementPressedState(element)
    });
    return Object.keys(states).length > 0 ? states : void 0;
  };
  var getElementDisabledState = (element) => {
    const ariaDisabled = element.getAttribute("aria-disabled");
    if (ariaDisabled === "true") {
      return true;
    }
    return isElementDisabled(element) ? true : void 0;
  };
  var getElementSelectedState = (element) => {
    const ariaSelected = element.getAttribute("aria-selected");
    if (ariaSelected === "true" || ariaSelected === "false") {
      return ariaSelected === "true";
    }
    return element.tagName.toLowerCase() === "option" ? element.selected : void 0;
  };
  var getElementExpandedState = (element) => {
    const ariaExpanded = element.getAttribute("aria-expanded");
    if (ariaExpanded === "true" || ariaExpanded === "false") {
      return ariaExpanded === "true";
    }
    return element.tagName.toLowerCase() === "details" ? element.open : void 0;
  };
  var getElementCheckedState = (element) => {
    const ariaChecked = element.getAttribute("aria-checked");
    if (ariaChecked === "mixed") {
      return "mixed";
    }
    if (ariaChecked === "true" || ariaChecked === "false") {
      return ariaChecked === "true";
    }
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      return element.indeterminate ? "mixed" : element.checked;
    }
    return void 0;
  };
  var getElementCurrentState = (element) => {
    const ariaCurrent = element.getAttribute("aria-current")?.trim().toLowerCase();
    if (!ariaCurrent || ariaCurrent === "false") {
      return void 0;
    }
    return ariaCurrent === "true" ? true : ariaCurrent;
  };
  var getElementPressedState = (element) => {
    const ariaPressed = element.getAttribute("aria-pressed");
    if (ariaPressed === "mixed") {
      return "mixed";
    }
    if (ariaPressed === "true" || ariaPressed === "false") {
      return ariaPressed === "true";
    }
    return void 0;
  };
  var removeUndefinedAccessibilityStates = (states) => Object.fromEntries(
    Object.entries(states).filter(([, value]) => value !== void 0)
  );
  var isLabelableElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    return tagName === "button" || tagName === "input" || tagName === "meter" || tagName === "output" || tagName === "progress" || tagName === "select" || tagName === "textarea";
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
    overflowX: style.overflowX,
    overflowY: style.overflowY,
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
  var isAccessibilityHidden = (element, frameWindow) => {
    if (element.getAttribute("aria-hidden") === "true" || element.hasAttribute("hidden")) {
      return true;
    }
    if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
      return false;
    }
    const computedStyle = frameWindow.getComputedStyle(element);
    return computedStyle.display === "none" || computedStyle.visibility === "hidden";
  };
  var isElementFocusable = (element) => {
    if (isElementDisabled(element)) {
      return false;
    }
    if (element instanceof HTMLAnchorElement) {
      return element.hasAttribute("href");
    }
    if (element instanceof HTMLButtonElement) {
      return true;
    }
    if (element instanceof HTMLInputElement) {
      return element.type !== "hidden";
    }
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      return true;
    }
    if (element.tagName.toLowerCase() === "summary") {
      return true;
    }
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      if (element.tabIndex >= 0) {
        return true;
      }
      const contentEditable = element.getAttribute("contenteditable");
      return Boolean(contentEditable && contentEditable.toLowerCase() !== "false");
    }
    return false;
  };
  var isElementDisabled = (element) => {
    const tagName = element.tagName.toLowerCase();
    switch (tagName) {
      case "button":
      case "fieldset":
      case "input":
      case "optgroup":
      case "option":
      case "select":
      case "textarea":
        return element.disabled;
      default:
        return false;
    }
  };
  var isTransparentColor = (value) => {
    const normalized = normalizeComparableText(value);
    return normalized.length === 0 || normalized === "transparent" || /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/.test(normalized);
  };
  var truncateEvidenceValue = (value, maxLength) => value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  var roundNumber = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  function getEffectiveViewportSize(frameWindow, viewportFallback) {
    const document = frameWindow.document;
    const normalizedFallback = normalizeViewportFallback(viewportFallback);
    return {
      width: Math.max(
        roundNumber(frameWindow.innerWidth),
        roundNumber(frameWindow.visualViewport?.width ?? 0),
        roundNumber(document.documentElement.clientWidth),
        roundNumber(document.body?.clientWidth ?? 0),
        normalizedFallback?.width ?? 0
      ),
      height: Math.max(
        roundNumber(frameWindow.innerHeight),
        roundNumber(frameWindow.visualViewport?.height ?? 0),
        roundNumber(document.documentElement.clientHeight),
        roundNumber(document.body?.clientHeight ?? 0),
        normalizedFallback?.height ?? 0
      )
    };
  }
  function normalizeViewportFallback(viewportFallback) {
    if (!viewportFallback) {
      return void 0;
    }
    return {
      width: Math.max(1, roundNumber(viewportFallback.width)),
      height: Math.max(1, roundNumber(viewportFallback.height))
    };
  }
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
