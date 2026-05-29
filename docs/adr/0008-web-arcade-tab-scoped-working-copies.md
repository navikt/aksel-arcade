# Web Arcade tab-scoped working copies

Web Arcade will use tab-scoped working copies instead of a browser-wide last project so multiple open tabs can edit independently without overwriting each other. The Web implementation should persist each working copy in `sessionStorage`: a working copy survives reloads in its own tab, duplicating a tab forks the visible work, and opening an ordinary Web Arcade URL starts a new default Untitled Project; durable transfer or recovery remains explicit through Share or Export. This trades away implicit browser-wide restore, including legacy saved project recovery, because the product value here is predictable tab isolation rather than hidden cross-tab persistence.

The Web UI should remove normal autosave success/saving status, but still surface autosave failures because a failure means same-tab reload safety is broken.
