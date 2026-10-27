export const themeStorageKey = "talasea.theme";

export const themeInitScript =
  '(function(){try{var t=localStorage.getItem("talasea.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();';
