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
    MAX_PREVIEW_INTERACTION_STEPS: () => MAX_PREVIEW_INTERACTION_STEPS,
    MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS: () => MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS,
    MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS: () => MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS,
    PREVIEW_EVIDENCE_ROOT_SELECTOR: () => PREVIEW_EVIDENCE_ROOT_SELECTOR,
    capturePreviewEvidenceSnapshot: () => capturePreviewEvidenceSnapshot,
    collectPreviewEvidenceFromFrame: () => collectPreviewEvidenceFromFrame,
    combineResolvedAnnotationTargets: () => combineResolvedAnnotationTargets,
    getAnnotationTargetIdentity: () => getAnnotationTargetIdentity,
    isAnnotationTargetResolutionRequest: () => isAnnotationTargetResolutionRequest,
    registerPreviewEvidenceRequestHandler: () => registerPreviewEvidenceRequestHandler,
    requestPreviewEvidenceFromFrame: () => requestPreviewEvidenceFromFrame,
    resolveAnnotationTarget: () => resolveAnnotationTarget,
    resolveAnnotationTargetAtPoint: () => resolveAnnotationTargetAtPoint,
    resolveAnnotationTargetGroup: () => resolveAnnotationTargetGroup,
    resolveAnnotationTargetIdentity: () => resolveAnnotationTargetIdentity,
    resolveAnnotationTargetsInRect: () => resolveAnnotationTargetsInRect,
    runPreviewInteractionSequence: () => runPreviewInteractionSequence,
    serializePreviewEvidence: () => serializePreviewEvidence
  });

  // src/services/domAccessibility.ts
  var normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();
  var isExcludedElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    return tagName === "script" || tagName === "style" || tagName === "template" || tagName === "noscript" || tagName === "html" || tagName === "body";
  };
  var getVisibleText = (element) => normalizeWhitespace(getSanitizedSubtreeText(element));
  var getElementRole = (element, { ignorePresentationalRole = false, treatSummaryAsButton = false } = {}) => {
    const explicitRole = element.getAttribute("role")?.trim().toLowerCase();
    if (explicitRole) {
      if (ignorePresentationalRole && (explicitRole === "none" || explicitRole === "presentation")) {
        return "";
      }
      return explicitRole;
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a" && element.hasAttribute("href")) return "link";
    if (tagName === "textarea") return "textbox";
    if (tagName === "select") return "combobox";
    if (tagName === "option") return "option";
    if (tagName === "img") return "img";
    if (tagName === "summary" && treatSummaryAsButton) return "button";
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
  var getElementAccessibleName = (element, { includeImplicitLinkText = true } = {}) => {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return normalizeWhitespace(ariaLabel);
    }
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map((id) => {
        const referencedElement = element.ownerDocument.getElementById(id);
        return referencedElement ? getVisibleText(referencedElement) : "";
      }).join(" ");
      if (text.trim()) {
        return normalizeWhitespace(text);
      }
    }
    const altText = getElementAltText(element);
    if (altText) {
      return altText;
    }
    const labelText = getElementLabelText(element);
    if (labelText) {
      return labelText;
    }
    const title = element.getAttribute("title");
    if (title) {
      return normalizeWhitespace(title);
    }
    if (element instanceof HTMLInputElement && inputUsesValueAsAccessibleName(element) && element.value) {
      return normalizeWhitespace(element.value);
    }
    return elementUsesContentAsAccessibleName(element, { includeImplicitLinkText }) ? getVisibleText(element) : "";
  };
  var hasExplicitAccessibleName = (element) => element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || getElementAltText(element).length > 0 || element.hasAttribute("title") || getElementLabelText(element).length > 0 || element instanceof HTMLInputElement && inputUsesValueAsAccessibleName(element) && normalizeWhitespace(element.value).length > 0;
  var getElementLabelText = (element) => {
    if (!(element instanceof HTMLElement) || !isLabelableElement(element)) {
      return "";
    }
    const labels = Array.from(element.labels ?? []);
    if (labels.length > 0) {
      return normalizeWhitespace(labels.map((label) => getVisibleText(label)).join(" "));
    }
    if (element.id) {
      const label = Array.from(element.ownerDocument.querySelectorAll("label[for]")).find(
        (candidate) => candidate.getAttribute("for") === element.id
      );
      if (label) {
        return getVisibleText(label);
      }
    }
    const wrappingLabel = element.closest("label");
    return wrappingLabel ? getVisibleText(wrappingLabel) : "";
  };
  var getSanitizedSubtreeText = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node;
      if (isExcludedElement(element) || element.getAttribute("aria-hidden") === "true" || element.hasAttribute("hidden")) {
        return "";
      }
    }
    return Array.from(node.childNodes).map((child) => getSanitizedSubtreeText(child)).join(" ");
  };
  var getElementAltText = (element) => {
    if (element instanceof HTMLImageElement) {
      return normalizeWhitespace(element.getAttribute("alt") ?? "");
    }
    if (element instanceof HTMLInputElement && element.type === "image") {
      return normalizeWhitespace(element.getAttribute("alt") ?? "");
    }
    return "";
  };
  var inputUsesValueAsAccessibleName = (input) => input.type === "button" || input.type === "submit" || input.type === "reset";
  var elementUsesContentAsAccessibleName = (element, { includeImplicitLinkText }) => {
    const explicitRole = element.getAttribute("role")?.trim().toLowerCase();
    if (explicitRole) {
      return explicitRole === "button" || explicitRole === "cell" || explicitRole === "checkbox" || explicitRole === "columnheader" || explicitRole === "gridcell" || explicitRole === "heading" || explicitRole === "link" || explicitRole === "menuitem" || explicitRole === "menuitemcheckbox" || explicitRole === "menuitemradio" || explicitRole === "option" || explicitRole === "radio" || explicitRole === "rowheader" || explicitRole === "switch" || explicitRole === "tab" || explicitRole === "tooltip" || explicitRole === "treeitem";
    }
    const tagName = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      return true;
    }
    if (tagName === "button" || tagName === "option" || tagName === "summary") {
      return true;
    }
    return Boolean(includeImplicitLinkText) && tagName === "a" && element.hasAttribute("href");
  };
  var isLabelableElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    return tagName === "button" || tagName === "input" || tagName === "meter" || tagName === "output" || tagName === "progress" || tagName === "select" || tagName === "textarea";
  };

  // src/services/annotationTargets.ts
  var isAnnotationTargetResolutionRequest = (value) => {
    if (!isRecord(value) || typeof value.mode !== "string") {
      return false;
    }
    switch (value.mode) {
      case "point":
        return isFiniteNumber(value.x) && isFiniteNumber(value.y) && optionalString(value.selectedText);
      case "rect":
        return isAnnotationTargetRect(value.rect);
      case "identity":
        return isAnnotationTargetIdentity(value.identity);
      case "group":
        return Array.isArray(value.identities) && value.identities.every(isAnnotationTargetIdentity);
      default:
        return false;
    }
  };
  var INTERACTIVE_TARGET_SELECTOR = [
    "button",
    "a[href]",
    "input",
    "textarea",
    "select",
    "option",
    "label",
    "summary",
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    "[onclick]"
  ].join(",");
  var COMPONENT_INTERNAL_TARGET_SELECTOR = [
    ".aksel-inline-message__icon",
    ".aksel-inline-message__icon *"
  ].join(",");
  var MAX_TEXT_LENGTH = 500;
  var resolveAnnotationTarget = (root, request, frameWindow = root.ownerDocument.defaultView ?? window) => {
    switch (request.mode) {
      case "point":
        return resolveAnnotationTargetAtPoint(root, request, frameWindow);
      case "rect":
        return resolveAnnotationTargetsInRect(root, request.rect, frameWindow);
      case "identity":
        return resolveAnnotationTargetIdentity(root, request.identity, frameWindow);
      case "group":
        return resolveAnnotationTargetGroup(root, request.identities, frameWindow);
    }
  };
  var resolveAnnotationTargetAtPoint = (root, request, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const selectionTarget = resolveSelectedTextTarget(root, request.selectedText, frameWindow);
    if (selectionTarget) {
      return createResolvedResult(root, selectionTarget.element, frameWindow, {
        x: request.x,
        y: request.y,
        selectedText: selectionTarget.selectedText
      });
    }
    const rawElement = deepElementFromPoint(root, request.x, request.y);
    const element = rawElement ? normalizeAnnotationElement(root, rawElement, frameWindow) : null;
    if (!element) {
      return {
        status: "no-target",
        reason: "no-match",
        matchCount: 0
      };
    }
    return createResolvedResult(root, element, frameWindow, {
      x: request.x,
      y: request.y,
      selectedText: request.selectedText
    });
  };
  var resolveAnnotationTargetsInRect = (root, rect, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const normalizedRect = normalizeSelectionRect(rect);
    if (!normalizedRect || normalizedRect.width === 0 || normalizedRect.height === 0) {
      return {
        status: "no-target",
        reason: "empty-selection",
        matchCount: 0
      };
    }
    const matchingElements = filterContainedElements(
      getAnnotatableCandidates(root, frameWindow).filter((element) => {
        const elementRect = element.getBoundingClientRect();
        return hasUsableGeometry(elementRect) && rectsIntersect(elementRect, normalizedRect) && !isPreviewChromeElement(element);
      })
    );
    if (matchingElements.length === 0) {
      return {
        status: "no-target",
        reason: "empty-selection",
        matchCount: 0
      };
    }
    if (matchingElements.length === 1) {
      return createResolvedResult(root, matchingElements[0], frameWindow, {
        x: normalizedRect.x + normalizedRect.width,
        y: normalizedRect.y + normalizedRect.height
      });
    }
    return combineResolvedAnnotationTargets(
      matchingElements.map(
        (element) => createResolvedTarget(root, element, frameWindow, {
          x: normalizedRect.x + normalizedRect.width,
          y: normalizedRect.y + normalizedRect.height,
          isMultiSelect: true
        })
      )
    );
  };
  var resolveAnnotationTargetIdentity = (root, identity, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const pathMatch = queryFullPath(root, identity.fullPath);
    if (pathMatch && isAnnotatableElement(pathMatch, frameWindow) && getAnnotationTargetIdentity(root, pathMatch, frameWindow).signature === identity.signature) {
      const target2 = createResolvedTarget(root, pathMatch, frameWindow);
      return {
        status: target2.visibility === "visible" ? "resolved" : "hidden",
        target: target2,
        matchCount: 1
      };
    }
    const matches = getAnnotatableCandidates(root, frameWindow).filter(
      (candidate) => getAnnotationTargetIdentity(root, candidate, frameWindow).signature === identity.signature
    );
    if (matches.length === 0) {
      return {
        status: "dead",
        reason: "no-match",
        matchCount: 0
      };
    }
    if (matches.length > 1) {
      return {
        status: "dead",
        reason: "ambiguous-match",
        matchCount: matches.length
      };
    }
    const target = createResolvedTarget(root, matches[0], frameWindow);
    return {
      status: target.visibility === "visible" ? "resolved" : "hidden",
      target,
      matchCount: 1
    };
  };
  var resolveAnnotationTargetGroup = (root, identities, frameWindow = root.ownerDocument.defaultView ?? window) => {
    if (identities.length === 0) {
      return {
        status: "no-target",
        reason: "empty-selection",
        matchCount: 0
      };
    }
    const resolvedTargets = [];
    for (const identity of identities) {
      const result = resolveAnnotationTargetIdentity(root, identity, frameWindow);
      if (!result.target || result.status !== "resolved" && result.status !== "hidden") {
        return {
          status: "dead",
          reason: "partial-group",
          matchCount: resolvedTargets.length
        };
      }
      resolvedTargets.push(result.target);
    }
    return combineResolvedAnnotationTargets(resolvedTargets);
  };
  var combineResolvedAnnotationTargets = (targets) => {
    if (targets.length === 0) {
      return {
        status: "no-target",
        reason: "empty-selection",
        matchCount: 0
      };
    }
    if (targets.length === 1) {
      const [target] = targets;
      return {
        status: target.visibility === "visible" ? "resolved" : "hidden",
        target,
        targets: [target],
        matchCount: 1
      };
    }
    const visibleTargets = targets.filter((target) => target.visibility === "visible");
    const boxes = visibleTargets.map((target) => target.snapshot.boundingBox).filter((box) => Boolean(box));
    const unionBox = unionRects(boxes);
    const primaryTarget = targets[0];
    return {
      status: visibleTargets.length > 0 ? "resolved" : "hidden",
      targets: targets.map((target) => ({
        ...target,
        identity: { ...target.identity },
        snapshot: {
          ...target.snapshot,
          ...target.snapshot.boundingBox ? { boundingBox: { ...target.snapshot.boundingBox } } : {}
        }
      })),
      target: {
        ...primaryTarget,
        identity: { ...primaryTarget.identity },
        snapshot: {
          ...primaryTarget.snapshot,
          element: targets.map((target) => target.snapshot.element).join(", "),
          elementPath: targets.map((target) => target.identity.elementPath).join(" | "),
          fullPath: targets.map((target) => target.identity.fullPath).join(" | "),
          targetIdentities: targets.map((target) => ({ ...target.identity })),
          isMultiSelect: true,
          ...unionBox ? { boundingBox: unionBox } : {},
          elementBoundingBoxes: boxes
        }
      },
      matchCount: targets.length
    };
  };
  var getAnnotationTargetIdentity = (root, element, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const tagName = element.tagName.toLowerCase();
    const role = getElementRole2(element);
    const accessibleName = getElementAccessibleName2(element);
    const text = getVisibleText(element);
    const cssClasses = getElementClasses(element);
    const elementPath = getReadableElementPath(root, element);
    const fullPath = getFullElementPath(root, element);
    const signature = createAnnotationTargetIdentitySignature({
      tagName,
      role,
      accessibleName,
      text,
      cssClasses
    });
    void frameWindow;
    return {
      signature,
      tagName,
      ...role ? { role } : {},
      ...accessibleName ? { accessibleName } : {},
      ...text ? { text: truncateText(text, MAX_TEXT_LENGTH) } : {},
      ...cssClasses ? { cssClasses } : {},
      elementPath,
      fullPath
    };
  };
  var createResolvedResult = (root, element, frameWindow, options = {}) => {
    const target = createResolvedTarget(root, element, frameWindow, options);
    return {
      status: target.visibility === "visible" ? "resolved" : "hidden",
      target,
      matchCount: 1
    };
  };
  var createResolvedTarget = (root, element, frameWindow, options = {}) => {
    const identity = getAnnotationTargetIdentity(root, element, frameWindow);
    const rect = element.getBoundingClientRect();
    const isFixed = frameWindow.getComputedStyle(element).position === "fixed";
    const pageX = typeof options.x === "number" ? options.x : rect.left + rect.width / 2;
    const pageY = typeof options.y === "number" ? options.y : rect.top + rect.height / 2;
    const snapshot = {
      x: frameWindow.innerWidth > 0 ? pageX / frameWindow.innerWidth * 100 : pageX,
      y: isFixed ? pageY : pageY + frameWindow.scrollY,
      element: describeElement(element),
      elementPath: identity.elementPath,
      targetIdentities: [{ ...identity }],
      clickOffsetX: pageX - rect.left,
      clickOffsetY: pageY - rect.top,
      boundingBox: {
        x: rect.left,
        y: isFixed ? rect.top : rect.top + frameWindow.scrollY,
        width: rect.width,
        height: rect.height
      },
      nearbyText: getNearbyText(element),
      cssClasses: identity.cssClasses,
      computedStyles: getComputedStyleSummary(element, frameWindow),
      fullPath: identity.fullPath,
      accessibility: getAccessibilitySummary(element),
      isFixed,
      ...options.isMultiSelect ? { isMultiSelect: true } : {},
      ...options.selectedText ? { selectedText: truncateText(options.selectedText, MAX_TEXT_LENGTH) } : {}
    };
    return {
      identity,
      snapshot,
      visibility: isElementVisibleInViewport(element, frameWindow) ? "visible" : "hidden"
    };
  };
  var createAnnotationTargetIdentitySignature = ({
    tagName,
    role,
    accessibleName,
    text,
    cssClasses
  }) => stableStringify({
    tagName,
    role,
    accessibleName: normalizeComparableText(accessibleName),
    text: normalizeComparableText(text),
    cssClasses: normalizeComparableText(cssClasses)
  });
  var deepElementFromPoint = (root, x, y) => {
    if (typeof root.ownerDocument.elementFromPoint !== "function") {
      return null;
    }
    let element = root.ownerDocument.elementFromPoint(x, y);
    while (element?.shadowRoot) {
      const nested = element.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === element) {
        break;
      }
      element = nested;
    }
    return element && root.contains(element) ? element : null;
  };
  var normalizeAnnotationElement = (root, element, frameWindow) => {
    if (isExcludedElement(element) || isPreviewChromeElement(element)) {
      return null;
    }
    const componentRoot = getComponentRootForInternalElement(element, root);
    if (componentRoot && isAnnotatableElement(componentRoot, frameWindow)) {
      return componentRoot;
    }
    const interactive = closestWithinRoot(element, root, INTERACTIVE_TARGET_SELECTOR);
    if (interactive && isAnnotatableElement(interactive, frameWindow)) {
      return interactive;
    }
    let current = element;
    while (current && current !== root && current !== root.ownerDocument.body) {
      if (isAnnotatableElement(current, frameWindow)) {
        return current;
      }
      current = current.parentElement;
    }
    return isAnnotatableElement(root, frameWindow) ? root : null;
  };
  var getComponentRootForInternalElement = (element, root) => {
    const inlineMessageInternal = closestWithinRoot(element, root, COMPONENT_INTERNAL_TARGET_SELECTOR);
    return inlineMessageInternal ? closestWithinRoot(inlineMessageInternal, root, ".aksel-inline-message") : null;
  };
  var getAnnotatableCandidates = (root, frameWindow) => [root, ...Array.from(root.querySelectorAll("*"))].filter((candidate) => root.contains(candidate)).map((candidate) => normalizeAnnotationElement(root, candidate, frameWindow)).filter((candidate) => Boolean(candidate)).filter((candidate, index, candidates) => candidates.indexOf(candidate) === index);
  var filterContainedElements = (elements) => elements.filter(
    (element) => !elements.some((otherElement) => otherElement !== element && element.contains(otherElement))
  );
  var isAnnotatableElement = (element, frameWindow) => {
    if (isExcludedElement(element) || isPreviewChromeElement(element)) {
      return false;
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === "html" || tagName === "body") {
      return false;
    }
    const style = frameWindow.getComputedStyle(element);
    return style.display !== "none" && style.display !== "contents" && style.visibility !== "hidden" && style.visibility !== "collapse";
  };
  var isPreviewChromeElement = (element) => Boolean(
    element.closest(
      "[data-annotation-marker], [data-annotation-popup], [data-feedback-toolbar], [data-inspect-overlay]"
    )
  );
  var resolveSelectedTextTarget = (root, explicitSelectedText, frameWindow) => {
    const selection = frameWindow.getSelection?.();
    const selectedText = truncateText(
      normalizeWhitespace(explicitSelectedText ?? selection?.toString() ?? ""),
      MAX_TEXT_LENGTH
    );
    if (!selectedText || !selection || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const element = commonAncestor ? normalizeAnnotationElement(root, commonAncestor, frameWindow) : null;
    return element ? { element, selectedText } : null;
  };
  var queryFullPath = (root, fullPath) => {
    if (!fullPath) {
      return null;
    }
    try {
      return fullPath === ":scope" ? root : root.querySelector(fullPath);
    } catch (error) {
      if (error instanceof DOMException) {
        console.warn("Invalid annotation target selector path:", {
          fullPath,
          message: error.message
        });
        return null;
      }
      throw error;
    }
  };
  var getReadableElementPath = (root, element, maxDepth = 4) => {
    const parts = [];
    let current = element;
    let depth = 0;
    while (current && current !== root && depth < maxDepth) {
      parts.unshift(getReadableElementIdentifier(current));
      current = current.parentElement;
      depth += 1;
    }
    return parts.join(" > ") || getReadableElementIdentifier(element);
  };
  var getReadableElementIdentifier = (element) => {
    const tagName = element.tagName.toLowerCase();
    const name = getElementAccessibleName2(element) || getVisibleText(element);
    if (name) {
      return `${tagName} "${truncateText(name, 35)}"`;
    }
    const classes = getTargetClassNames(element).slice(0, 1);
    return classes.length > 0 ? `${tagName}.${classes[0]}` : tagName;
  };
  var getFullElementPath = (root, element) => {
    if (element === root) {
      return ":scope";
    }
    const parts = [];
    let current = element;
    while (current && current !== root) {
      const tagName = current.tagName.toLowerCase();
      const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(
        (sibling) => sibling.tagName.toLowerCase() === tagName
      ) : [];
      const index = Math.max(1, siblings.indexOf(current) + 1);
      parts.unshift(`${tagName}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    return parts.join(" > ");
  };
  var describeElement = (element) => {
    const role = getElementRole2(element);
    const name = getElementAccessibleName2(element) || getVisibleText(element);
    if (role && name) {
      return `${role} "${truncateText(name, 40)}"`;
    }
    if (name) {
      return `${element.tagName.toLowerCase()} "${truncateText(name, 40)}"`;
    }
    return role || element.tagName.toLowerCase();
  };
  var getElementRole2 = (element) => getElementRole(element, {
    ignorePresentationalRole: true,
    treatSummaryAsButton: true
  });
  var getElementAccessibleName2 = (element) => getElementAccessibleName(element, {
    includeImplicitLinkText: false
  });
  var getNearbyText = (element) => {
    const texts = [
      element.previousElementSibling ? getVisibleText(element.previousElementSibling) : "",
      getVisibleText(element),
      element.nextElementSibling ? getVisibleText(element.nextElementSibling) : ""
    ].map((text) => truncateText(text, 80)).filter(Boolean);
    return texts.join(" ");
  };
  var getElementClasses = (element) => {
    const classes = getTargetClassNames(element);
    return classes.length > 0 ? classes.join(" ") : void 0;
  };
  var getTargetClassNames = (element) => Array.from(element.classList ?? []).filter((className) => className.length > 1 && !/^[a-z]{1,2}$/.test(className)).slice(0, 12);
  var getComputedStyleSummary = (element, frameWindow) => {
    const style = frameWindow.getComputedStyle(element);
    const entries = [
      ["display", style.display],
      ["position", style.position],
      ["color", style.color],
      ["backgroundColor", style.backgroundColor],
      ["fontSize", style.fontSize],
      ["fontWeight", style.fontWeight]
    ].filter(([, value]) => value);
    return entries.map(([key, value]) => `${key}: ${value}`).join("; ");
  };
  var getAccessibilitySummary = (element) => {
    const role = getElementRole2(element);
    const name = getElementAccessibleName2(element);
    if (!role && !name) {
      return void 0;
    }
    return [role ? `role=${role}` : null, name ? `name="${name}"` : null].filter(Boolean).join(" ");
  };
  var closestWithinRoot = (element, root, selector) => {
    const closest = element.closest(selector);
    return closest && root.contains(closest) ? closest : null;
  };
  var isElementVisibleInViewport = (element, frameWindow) => {
    const style = frameWindow.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return hasUsableGeometry(rect) && rect.right > 0 && rect.bottom > 0 && rect.left < frameWindow.innerWidth && rect.top < frameWindow.innerHeight;
  };
  var normalizeSelectionRect = (rect) => {
    const left = Math.min(rect.x, rect.x + rect.width);
    const top = Math.min(rect.y, rect.y + rect.height);
    const width = Math.abs(rect.width);
    const height = Math.abs(rect.height);
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    return {
      x: left,
      y: top,
      width,
      height
    };
  };
  var rectsIntersect = (left, right) => left.left < right.x + right.width && left.right > right.x && left.top < right.y + right.height && left.bottom > right.y;
  var hasUsableGeometry = (rect) => rect.width >= 1 && rect.height >= 1;
  var unionRects = (rects) => {
    if (rects.length === 0) {
      return null;
    }
    const bounds = rects.reduce(
      (acc, rect) => ({
        left: Math.min(acc.left, rect.x),
        top: Math.min(acc.top, rect.y),
        right: Math.max(acc.right, rect.x + rect.width),
        bottom: Math.max(acc.bottom, rect.y + rect.height)
      }),
      {
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity
      }
    );
    return {
      x: bounds.left,
      y: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top
    };
  };
  var normalizeComparableText = (value) => normalizeWhitespace(value ?? "").toLowerCase();
  var truncateText = (value, maxLength) => value.length > maxLength ? value.slice(0, maxLength) : value;
  var stableStringify = (value) => JSON.stringify(
    Object.keys(value).sort().reduce((acc, key) => {
      const item = value[key];
      if (item) {
        acc[key] = item;
      }
      return acc;
    }, {})
  );
  var isAnnotationTargetRect = (value) => isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.width) && isFiniteNumber(value.height);
  var isAnnotationTargetIdentity = (value) => isRecord(value) && typeof value.signature === "string" && typeof value.tagName === "string" && typeof value.elementPath === "string" && typeof value.fullPath === "string" && optionalString(value.role) && optionalString(value.accessibleName) && optionalString(value.text) && optionalString(value.cssClasses);
  var optionalString = (value) => value === void 0 || typeof value === "string";
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

  // src/services/previewEvidence.ts
  var PREVIEW_EVIDENCE_ROOT_SELECTOR = "#root";
  var MAX_PREVIEW_EVIDENCE_ELEMENTS = 200;
  var MAX_PREVIEW_INTERACTION_STEPS = 10;
  var MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS = 1e4;
  var MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 5e3;
  var MAX_PREVIEW_EVIDENCE_TEXT_LENGTH = 200;
  var MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH = 200;
  var MAX_PREVIEW_EVIDENCE_CLASS_NAMES = 30;
  var DEFAULT_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 1500;
  var PREVIEW_INTERACTION_POLL_INTERVAL_MS = 16;
  var PREVIEW_INTERACTION_SETTLE_FRAMES = 2;
  var PREVIEW_INTERACTION_RENDER_IDLE_MS = 100;
  var PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN = /^[^\s]$/;
  var PREVIEW_INTERACTION_SUPPORTED_KEYS = /* @__PURE__ */ new Set([
    "Enter",
    "Escape",
    "Tab",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Backspace",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Space",
    " "
  ]);
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
    interactionState,
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
          ...screenshot?.targetDescription ? { targetDescription: screenshot.targetDescription } : {},
          ...interactionState ? { interactions: interactionState } : {}
        }
      };
    } catch (error) {
      const code = isTaggedPreviewCaptureError(error) ? error.code : "preview-unavailable";
      const message = getErrorMessage(error);
      return createPreviewCaptureFailure(
        code,
        code === "preview-unavailable" ? `Preview evidence could not be captured: ${message}` : message,
        {
          ...currentPageId !== null || interactionState ? {
            captureMeta: {
              ...currentPageId !== null ? { currentPageId } : {},
              ...interactionState ? { interactions: interactionState } : {}
            }
          } : {}
        }
      );
    }
  };
  var runPreviewInteractionSequence = async (root, interactions, {
    currentPageId = null,
    getCurrentPageId,
    maxTotalTimeMs = MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS
  } = {}, frameWindow = root.ownerDocument.defaultView ?? window) => {
    const requested = interactions.map(clonePreviewInteractionStep);
    const interactionState = {
      requested,
      executed: []
    };
    if (requested.length === 0) {
      return {
        ok: true,
        interactionState
      };
    }
    const deadline = Date.now() + Math.max(1, maxTotalTimeMs);
    for (const [index, step] of requested.entries()) {
      try {
        const targetDescription = await executePreviewInteractionStep(root, step, {
          deadline,
          frameWindow
        });
        interactionState.executed.push({
          index,
          step,
          ...targetDescription ? { targetDescription } : {}
        });
      } catch (error) {
        const code = isTaggedPreviewCaptureError(error) ? error.code : "invalid-capture-target";
        const reason = getErrorMessage(error);
        interactionState.failedStep = {
          index,
          step,
          reason
        };
        return createPreviewCaptureFailure(code, reason, {
          captureMeta: {
            currentPageId: readCurrentPreviewInteractionPageId(currentPageId, getCurrentPageId),
            interactions: interactionState
          }
        });
      }
    }
    return {
      ok: true,
      interactionState: {
        ...interactionState,
        requested,
        executed: [...interactionState.executed]
      }
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
      const element = queryPreviewTargetSelector(root, target.selector);
      if (!element || isExcludedElement(element)) {
        throw createTaggedPreviewCaptureError(
          "invalid-capture-target",
          "Preview region selector target did not match a preview element."
        );
      }
      return {
        element,
        targetDescription: `selector "${target.selector}"`
      };
    }
    const candidates = [root, ...Array.from(root.querySelectorAll("*"))];
    const normalizedRole = target.role?.toLowerCase();
    const normalizedName = normalizeComparableText2(target.name);
    const normalizedText = normalizeComparableText2(target.text);
    const normalizedLabel = normalizeComparableText2(target.label);
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
  var executePreviewInteractionStep = async (root, step, { deadline, frameWindow }) => {
    switch (step.action) {
      case "click":
        return executePreviewClickInteraction(root, step, frameWindow);
      case "fill":
        return executePreviewFillInteraction(root, step, frameWindow);
      case "select":
        return executePreviewSelectInteraction(root, step, frameWindow);
      case "press":
        return executePreviewPressInteraction(root, step, frameWindow);
      case "scroll":
        return executePreviewScrollInteraction(root, step, frameWindow);
      case "waitFor":
        return executePreviewWaitForInteraction(root, step, deadline, frameWindow);
    }
  };
  var executePreviewClickInteraction = async (root, step, frameWindow) => {
    const target = resolvePreviewInteractionTarget(root, step.target, "click");
    assertPreviewInteractionNavigationAllowed(target.element);
    focusPreviewInteractionElement(target.element);
    triggerPreviewClick(target.element);
    await settleAfterPreviewInteraction(frameWindow);
    return target.targetDescription;
  };
  var executePreviewFillInteraction = async (root, step, frameWindow) => {
    const target = resolvePreviewInteractionTarget(root, step.target, "fill");
    const input = resolveFillInteractionElement(target.element);
    focusPreviewInteractionElement(input);
    setFormControlValue(input, step.value);
    dispatchInputEvents(input);
    await settleAfterPreviewInteraction(frameWindow);
    return target.targetDescription;
  };
  var executePreviewSelectInteraction = async (root, step, frameWindow) => {
    const target = resolvePreviewInteractionTarget(root, step.target, "select");
    const control = resolveSelectableInteractionElement(target.element);
    if (control instanceof HTMLSelectElement) {
      if (typeof step.value !== "string") {
        throw createTaggedPreviewCaptureError(
          "invalid-capture-target",
          "Select interactions targeting a combobox/select control require a string value."
        );
      }
      const option = Array.from(control.options).find((candidate) => candidate.value === step.value);
      if (!option) {
        throw createTaggedPreviewCaptureError(
          "invalid-capture-target",
          "Select interaction value did not match an available option."
        );
      }
      setFormControlValue(control, step.value);
      Array.from(control.options).forEach((candidate) => {
        candidate.selected = candidate.value === step.value;
      });
      dispatchInputEvents(control);
      await settleAfterPreviewInteraction(frameWindow);
      return target.targetDescription;
    }
    if (typeof step.checked !== "boolean") {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Select interactions targeting checkbox/radio controls require a checked boolean."
      );
    }
    if (control instanceof HTMLInputElement && control.type === "radio" && !step.checked) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Radio controls may only be selected with checked=true during Preview interactions."
      );
    }
    setFormControlChecked(control, step.checked);
    dispatchInputEvents(control);
    await settleAfterPreviewInteraction(frameWindow);
    return target.targetDescription;
  };
  var executePreviewPressInteraction = async (root, step, frameWindow) => {
    const normalizedKey = normalizePreviewInteractionKey(step.key);
    const target = step.target ? resolvePreviewInteractionTarget(root, step.target, "press") : void 0;
    const element = resolvePressInteractionElement(root, target?.element);
    if (!element) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Press interactions require a focusable Preview element target or an existing focused Preview element."
      );
    }
    focusPreviewInteractionElement(element);
    dispatchKeyboardInteraction(element, normalizedKey, root, frameWindow);
    await settleAfterPreviewInteraction(frameWindow);
    return target?.targetDescription;
  };
  var executePreviewScrollInteraction = async (root, step, frameWindow) => {
    const deltaX = normalizePreviewInteractionNumber(step.x);
    const deltaY = normalizePreviewInteractionNumber(step.y);
    if (deltaX === 0 && deltaY === 0) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Scroll interactions require a non-zero x or y delta."
      );
    }
    const target = step.target ? resolvePreviewInteractionTarget(root, step.target, "scroll") : void 0;
    if (target?.element instanceof HTMLElement) {
      target.element.scrollLeft += deltaX;
      target.element.scrollTop += deltaY;
      target.element.dispatchEvent(new Event("scroll", { bubbles: true }));
    } else if (typeof frameWindow.scrollTo === "function") {
      frameWindow.scrollTo(frameWindow.scrollX + deltaX, frameWindow.scrollY + deltaY);
    }
    await settleAfterPreviewInteraction(frameWindow);
    return target?.targetDescription;
  };
  var executePreviewWaitForInteraction = async (root, step, deadline, frameWindow) => {
    const timeoutMs = getPreviewInteractionWaitTimeout(step.timeoutMs, deadline);
    if (step.renderIdle) {
      await waitForPreviewRenderIdle(root, timeoutMs, frameWindow);
      return "renderIdle";
    }
    if (typeof step.text === "string") {
      const normalizedText = normalizeComparableText2(step.text);
      const startedAt2 = Date.now();
      while (Date.now() - startedAt2 < timeoutMs) {
        if (normalizeComparableText2(getVisibleText(root)).includes(normalizedText)) {
          return `text="${step.text}"`;
        }
        await waitForPreviewInteractionTick(frameWindow);
      }
      throw createTaggedPreviewCaptureError(
        "render-timeout",
        "Preview waitFor text matcher timed out before the state appeared."
      );
    }
    if (!step.target) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "waitFor interactions require text, target, or renderIdle."
      );
    }
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const resolvedTarget = tryResolvePreviewInteractionTarget(root, step.target, "waitFor");
      if (resolvedTarget) {
        return resolvedTarget.targetDescription;
      }
      await waitForPreviewInteractionTick(frameWindow);
    }
    throw createTaggedPreviewCaptureError(
      "render-timeout",
      `Preview waitFor ${describePreviewCaptureTargetMatcher(step.target)} timed out before the state appeared.`
    );
  };
  var resolvePreviewInteractionTarget = (root, target, kind) => {
    const resolved = tryResolvePreviewInteractionTarget(root, target, kind);
    if (!resolved) {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        `Preview interaction ${describePreviewCaptureTargetMatcher(target)} did not match a Preview element.`
      );
    }
    return resolved;
  };
  var tryResolvePreviewInteractionTarget = (root, target, kind) => {
    if (target.selector) {
      const element = queryPreviewTargetSelector(root, target.selector);
      if (!element || isExcludedElement(element)) {
        return null;
      }
      return {
        element,
        targetDescription: `selector "${target.selector}"`
      };
    }
    const candidates = [root, ...Array.from(root.querySelectorAll("*"))];
    const normalizedRole = target.role?.toLowerCase();
    const normalizedName = normalizeComparableText2(target.name);
    const normalizedText = normalizeComparableText2(target.text);
    const normalizedLabel = normalizeComparableText2(target.label);
    const matchingCandidates = candidates.filter(
      (candidate) => matchesPreviewCaptureTargetCandidate(candidate, {
        normalizedRole,
        normalizedName,
        normalizedText,
        normalizedLabel
      })
    ).sort((left, right) => {
      const scoreDifference = getPreviewInteractionTargetScore(right, kind) - getPreviewInteractionTargetScore(left, kind);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      return getPreviewTargetDepth(right) - getPreviewTargetDepth(left);
    });
    const matchingElement = matchingCandidates[0] ?? null;
    if (!matchingElement) {
      return null;
    }
    return {
      element: matchingElement,
      targetDescription: describePreviewCaptureTarget(target)
    };
  };
  var getPreviewInteractionTargetScore = (element, kind) => {
    let score = getPreviewTargetDepth(element);
    if (element instanceof HTMLLabelElement) {
      score -= 20;
    }
    const role = getElementRole(element);
    if (role !== "generic") {
      score += 10;
    }
    if (isElementFocusable(element)) {
      score += 25;
    }
    switch (kind) {
      case "click":
        if (isElementClickable(element)) score += 80;
        break;
      case "fill":
        if (isFillableInteractionElement(element)) score += 120;
        break;
      case "select":
        if (isSelectableInteractionElement(element)) score += 120;
        break;
      case "press":
        if (isElementFocusable(element)) score += 80;
        break;
      case "scroll":
        if (element instanceof HTMLElement) score += 20;
        break;
      case "waitFor":
        if (role !== "generic" || isElementFocusable(element)) score += 20;
        break;
    }
    return score;
  };
  var getPreviewTargetDepth = (element) => {
    let depth = 0;
    let current = element;
    while (current) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  };
  var queryPreviewTargetSelector = (root, selector) => {
    try {
      return root.matches(selector) ? root : root.querySelector(selector);
    } catch {
      throw createTaggedPreviewCaptureError(
        "invalid-capture-target",
        "Preview selector target is not a valid CSS selector."
      );
    }
  };
  var resolveFillInteractionElement = (element) => {
    const control = resolveAssociatedInteractionControl(element);
    if (control && isFillableInteractionElement(control)) {
      return control;
    }
    throw createTaggedPreviewCaptureError(
      "invalid-capture-target",
      "Fill interactions require a text input or textarea inside the Preview."
    );
  };
  var resolveSelectableInteractionElement = (element) => {
    const control = resolveAssociatedInteractionControl(element);
    if (control && isSelectableInteractionElement(control)) {
      return control;
    }
    throw createTaggedPreviewCaptureError(
      "invalid-capture-target",
      "Select interactions require a select, radio, or checkbox control inside the Preview."
    );
  };
  var resolvePressInteractionElement = (root, element) => {
    const candidate = element ?? (root.ownerDocument.activeElement instanceof HTMLElement && root.contains(root.ownerDocument.activeElement) ? root.ownerDocument.activeElement : getFocusablePreviewElements(root)[0] ?? null);
    if (!candidate) {
      return null;
    }
    const control = resolveAssociatedInteractionControl(candidate);
    return control instanceof HTMLElement ? control : candidate instanceof HTMLElement ? candidate : null;
  };
  var resolveAssociatedInteractionControl = (element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element;
    }
    if (element instanceof HTMLSelectElement) {
      return element;
    }
    if (element instanceof HTMLOptionElement) {
      return element.parentElement instanceof HTMLSelectElement ? element.parentElement : null;
    }
    if (element instanceof HTMLLabelElement) {
      const labelControl = element.control;
      if (labelControl) {
        return labelControl;
      }
    }
    return element.querySelector('input, textarea, select, [contenteditable="true"]') ?? (element.closest("label") instanceof HTMLLabelElement ? element.closest("label")?.control : null) ?? element;
  };
  var isFillableInteractionElement = (element) => {
    if (element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    }
    if (!(element instanceof HTMLInputElement)) {
      return false;
    }
    return !element.disabled && !element.readOnly && ["text", "search", "email", "url", "tel", "password", "number", ""].includes(element.type);
  };
  var isSelectableInteractionElement = (element) => {
    if (element instanceof HTMLSelectElement) {
      return !element.disabled;
    }
    return element instanceof HTMLInputElement && !element.disabled && (element.type === "checkbox" || element.type === "radio");
  };
  var isElementClickable = (element) => element instanceof HTMLElement && (typeof element.onclick === "function" || ["button", "a", "summary", "label"].includes(element.tagName.toLowerCase()) || element.getAttribute("role") === "button");
  var focusPreviewInteractionElement = (element) => {
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      element.focus();
    }
  };
  var triggerPreviewClick = (element) => {
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  };
  var dispatchKeyboardInteraction = (element, key, root, frameWindow) => {
    const keydownEvent = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true
    });
    const keydownAccepted = element.dispatchEvent(keydownEvent);
    if (keydownAccepted) {
      if (key === "Tab") {
        movePreviewFocus(root, element);
      } else if (key === "Enter" || key === " " || key === "Space") {
        if (isElementClickable(element)) {
          assertPreviewInteractionNavigationAllowed(element);
          triggerPreviewClick(element);
        }
      } else if (PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN.test(key)) {
        if (isFillableInteractionElement(element)) {
          setFormControlValue(element, `${element.value}${key}`);
          dispatchInputEvents(element);
        }
      } else if (key === "Backspace" && isFillableInteractionElement(element)) {
        setFormControlValue(element, element.value.slice(0, -1));
        dispatchInputEvents(element);
      }
    }
    element.dispatchEvent(
      new KeyboardEvent("keyup", {
        key,
        bubbles: true,
        cancelable: true
      })
    );
    if (key === "PageDown" || key === "ArrowDown") {
      frameWindow.dispatchEvent(new Event("scroll"));
    }
  };
  var movePreviewFocus = (root, currentElement) => {
    const focusableElements = getFocusablePreviewElements(root);
    if (focusableElements.length === 0) {
      return;
    }
    const currentIndex = focusableElements.indexOf(currentElement);
    const nextElement = focusableElements[(currentIndex + 1 + focusableElements.length) % focusableElements.length];
    nextElement.focus();
  };
  var getFocusablePreviewElements = (root) => [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (candidate) => candidate instanceof HTMLElement && isElementFocusable(candidate) && !isElementDisabled(candidate)
  );
  var setFormControlValue = (element, value) => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  };
  var setFormControlChecked = (element, checked) => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "checked");
    if (descriptor?.set) {
      descriptor.set.call(element, checked);
    } else {
      element.checked = checked;
    }
  };
  var dispatchInputEvents = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  };
  var normalizePreviewInteractionKey = (key) => {
    const normalizedKey = key.trim();
    if (PREVIEW_INTERACTION_SUPPORTED_KEYS.has(normalizedKey) || PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN.test(normalizedKey)) {
      return normalizedKey;
    }
    throw createTaggedPreviewCaptureError(
      "invalid-capture-target",
      "Preview press key is not supported for bounded Preview interactions."
    );
  };
  var normalizePreviewInteractionNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  var assertPreviewInteractionNavigationAllowed = (element) => {
    const anchor = element.closest("a");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href");
    const to = anchor.getAttribute("to");
    const targetPageId = href ?? to;
    if (targetPageId && /^page\d+$/.test(targetPageId)) {
      return;
    }
    throw createTaggedPreviewCaptureError(
      "invalid-capture-target",
      "Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed."
    );
  };
  var waitForPreviewRenderIdle = async (root, timeoutMs, frameWindow) => {
    const startedAt = Date.now();
    let lastMutationAt = startedAt;
    const observer = new MutationObserver(() => {
      lastMutationAt = Date.now();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
    try {
      while (Date.now() - startedAt < timeoutMs) {
        if (Date.now() - lastMutationAt >= PREVIEW_INTERACTION_RENDER_IDLE_MS) {
          return;
        }
        await waitForPreviewInteractionTick(frameWindow);
      }
    } finally {
      observer.disconnect();
    }
    throw createTaggedPreviewCaptureError(
      "render-timeout",
      "Preview waitFor renderIdle timed out before the render settled."
    );
  };
  var settleAfterPreviewInteraction = async (frameWindow) => {
    for (let index = 0; index < PREVIEW_INTERACTION_SETTLE_FRAMES; index += 1) {
      await waitForPreviewInteractionTick(frameWindow);
    }
  };
  var waitForPreviewInteractionTick = (frameWindow) => new Promise((resolve) => {
    frameWindow.setTimeout(resolve, PREVIEW_INTERACTION_POLL_INTERVAL_MS);
  });
  var getPreviewInteractionWaitTimeout = (timeoutMs, deadline) => {
    const remainingBudget = Math.max(1, deadline - Date.now());
    const requestedTimeout = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? Math.max(1, Math.min(timeoutMs, MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS)) : DEFAULT_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS;
    return Math.max(1, Math.min(requestedTimeout, remainingBudget));
  };
  var readCurrentPreviewInteractionPageId = (currentPageId, getCurrentPageId) => {
    if (!getCurrentPageId) {
      return currentPageId;
    }
    try {
      return getCurrentPageId();
    } catch {
      return currentPageId;
    }
  };
  var clonePreviewInteractionStep = (step) => {
    const base = {
      ...step
    };
    if ("target" in step && step.target) {
      base.target = { ...step.target };
    }
    return base;
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
    if (normalizedName && !normalizeComparableText2(getElementAccessibleName(candidate)).includes(normalizedName)) {
      return false;
    }
    if (normalizedText && !normalizeComparableText2(getVisibleText(candidate)).includes(normalizedText)) {
      return false;
    }
    if (normalizedLabel && !normalizeComparableText2(getElementLabelText(candidate)).includes(normalizedLabel)) {
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
  var describePreviewCaptureTargetMatcher = (target) => {
    if (target.selector) {
      return "selector target";
    }
    const parts = [
      target.role ? "role" : null,
      target.name ? "name" : null,
      target.text ? "text" : null,
      target.label ? "label" : null
    ].filter(Boolean);
    return parts.length > 0 ? `${parts.join("+")} target` : "target";
  };
  var normalizeComparableText2 = (value) => normalizeWhitespace(value ?? "").toLowerCase();
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
    const normalized = normalizeComparableText2(value);
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
  var createPreviewCaptureFailure = (code, message, extras = {}) => ({
    ok: false,
    error: {
      code,
      message
    },
    ...extras
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
