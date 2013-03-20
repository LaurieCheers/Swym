SWYM = {
  RunExample:function(node)
  {
    var result = SWYM.Eval(node.parentNode.firstChild.firstChild.textContent);
    node.parentNode.lastChild.textContent = result;
    node.parentNode.lastChild.style.display = 'block'; 
  }
};

var loadjs = function(filename)
{
  var scriptTag=document.createElement('script');
  scriptTag.setAttribute("type","text/javascript");
  scriptTag.setAttribute("src", filename);
  document.getElementsByTagName("head")[0].appendChild(scriptTag);
}

loadjs("http://swym.in/swym.js");
loadjs("http://swym.in/swymTokenize.js");
loadjs("http://swym.in/swymParser.js");
loadjs("http://swym.in/swymEtc.js");
loadjs("http://swym.in/swymRuntime.js");
loadjs("http://swym.in/swymCompile.js");
loadjs("http://swym.in/swymTypeCheck.js");
loadjs("http://swym.in/swymStdlyb.js");