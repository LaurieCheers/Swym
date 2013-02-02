SWYM = {};

function loadjs(filename)
{
  var scriptTag=document.createElement('script');
  scriptTag.setAttribute("type","text/javascript");
  scriptTag.setAttribute("src", filename);
  document.getElementsByTagName("head")[0].appendChild(scriptTag);
}

loadjs("swym.js");
loadjs("swymTokenize.js");
loadjs("swymParser.js");
loadjs("swymEtc.js");
loadjs("swymRuntime.js");
loadjs("swymCompile.js");
loadjs("swymTypeCheck.js");
loadjs("swymStdlyb.js");
