<?php
 
$wgHooks['ParserFirstCallInit'][] = 'wfSwymSetup';
 
function wfSwymSetup( Parser $parser )
{
    $parser->setHook( 'swym', 'wfSwymRender' );
    return true;
}
 
function wfSwymRender( $text, array $args, Parser $parser, PPFrame $frame )
{
	//$parser->disableCache();
	$body = htmlspecialchars(trim($text, " \n"));

    return "<div><pre>" . $body . "</pre>" .
	"<a onclick=\"SWYM.RunExample(this)\"><img src=\"play.png\">Run</a>".
	"<a onclick=\"SWYM.OpenEditor(this)\"><img src=\"edit.png\" style=\"margin-left:20px;\">Edit</a><br>".
	"<pre style=\"display: none; background-color:rgb(217, 243, 219)\"></pre></div>";
}