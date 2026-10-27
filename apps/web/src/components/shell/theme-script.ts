export const themeStorageKey = "talasea.theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
