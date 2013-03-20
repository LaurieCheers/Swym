<?php
 
$wgHooks['ParserFirstCallInit'][] = 'wfSwymSetup';
 
function wfSwymSetup( Parser $parser )
{
    $parser->setHook( 'swym', 'wfSwymRender' );
    return true;
}
 
function wfSwymRender( $text, array $args, Parser $parser, PPFrame $frame )
{
	$parser->disableCache();
	$body = htmlspecialchars(trim($text, " \n"));
	$main = "";
	if( strpos($body, "\n") === false )
	{
		$main = "<code>" . $body . "</code></br>";
	}
	else
	{
		$main = "<pre>" . $body . "</pre>";
	}

    return "<div>".$main."<a onclick=\"SWYM.RunExample(this)\"><img src=\"play.png\">Run</a><br><pre style=\"display: none;\"></pre></div>";
}