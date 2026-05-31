export const getMessageTargetOrigin = (location) =>
  location.protocol === 'file:' ? '*' : location.origin;

export const isTrustedParentMessage = (event, location, parentWindow) => {
  if (event.source !== parentWindow) {
    return false;
  }

  if (event.origin === location.origin) {
    return true;
  }

  return location.protocol === 'file:' && event.origin === 'null';
};

export const postMessageToParent = (parentWindow, message, location) => {
  parentWindow.postMessage(message, getMessageTargetOrigin(location));
};
