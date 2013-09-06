//=============================================================

SWYM.EtcMatchesExceptChildren = function(leftNode, rightNode)
{
	if ( leftNode === rightNode )
		return true;
	else if ( !leftNode || !rightNode )// !leftNode && !rightNode was caught by the previous case
		return false;
	else if ( leftNode.type !== rightNode.type )
		return false;
	else if ( leftNode.type === "node" )
	{
		return leftNode.op.text === rightNode.op.text &&
				leftNode.op.type === rightNode.op.type &&
				leftNode.children.length === rightNode.children.length;
	}
	else if ( leftNode.type === "fnnode" )
	{
		if( leftNode.argNames.length !== rightNode.argNames.length )
			return false;
			
		if( leftNode.name !== rightNode.name )
		{
			// kludge. For etc to work, function names have to match exactly... except that for numeric names, we ignore the second and third characters.
			// (to allow for the "th", "nd", "rd" and "st" suffixes.)
			if( leftNode.name[0] !== "#" || rightNode.name[0] !== "#" || leftNode.name.slice(3) !== rightNode.name.slice(3) )
				return false;
		}

		for( var Idx = 0; Idx < leftNode.argNames.length; ++Idx )
		{
			if( leftNode.argNames[Idx] !== rightNode.argNames[Idx] )
				return false;
		}
		
		return true;
	}
	else if ( leftNode.type === "name" )
	{
		return leftNode.text === rightNode.text;
	}
	else if ( leftNode.type === "literal" )
	{
		if ( leftNode.value === rightNode.value )
		{
			return true;
		}
		else if ( leftNode.etcSequence && leftNode.etcSequence[leftNode.etcSequence.length-1] === rightNode.value )
		{
			return true;
		}
		else if ( leftNode.etcSequence ||
			(typeof leftNode.value === "number" && typeof rightNode.value === "number")
			)
		{
			// NB not true - this value signifies a partial match. see "baseMatch !== true" in SWYM.MergeEtc
			return 1;
		}
	}
}

// returns true for a perfect match, false for no match; for a partial match, returns the number of discrepancies.
SWYM.EtcMatches = function(leftNode, rightNode)
{
	var match = SWYM.EtcMatchesExceptChildren(leftNode, rightNode);
	
	if( !match || !leftNode || (leftNode.type !== "node" && leftNode.type !== "fnnode") )
		return match;

	for( var Idx = 0; Idx < leftNode.children.length; Idx++ )
	{
		var newMatch = SWYM.EtcMatches(leftNode.children[Idx], rightNode.children[Idx]);
		if( !newMatch )
		{
			return false;
		}
		else if ( newMatch !== true )
		{
			if( match === true )
				match = 0;

			match += newMatch;
		}
	}
	
	return match;
}

SWYM.EtcFindBestMatch = function(leftTerm, possibleTerms)
{
	var bestMatchSoFar = false;
	var bestIdx = -1;
	for( var Idx = 0; Idx < possibleTerms.length; Idx++ )
	{
		var newMatch = SWYM.EtcMatches(leftTerm, possibleTerms[Idx]);
		if( newMatch === true )
		{
			if( bestMatchSoFar === true )
			{
				SWYM.LogError(possibleTerms[bestIdx].pos, "Ambiguous etc expression - too many perfect matches");
				return -1;
			}
			else
			{
				bestMatchSoFar = newMatch;
				bestIdx = Idx;
			}
		}
		else if ( newMatch !== false && bestMatchSoFar !== true && (bestMatchSoFar === false || newMatch < bestMatchSoFar) )
		{
			bestMatchSoFar = newMatch;
			bestIdx = Idx;
		}
	}
	
	return bestIdx;
}

SWYM.CloneNode = function(node, newChildren)
{
	if ( !newChildren )
	{
		newChildren = [];
		for( var Idx = 0; Idx < node.children.length; Idx++ )
			newChildren.push(node.children[Idx]);
	}
	
	if( node.type === "node" )
		return {type:"node", text:node.text, op:node.op, etcExpandAround:node.etcExpandAround, children:newChildren};
	else if ( node.type === "fnnode" )
		return {type:"fnnode", name:node.name, etcExpandAround:node.etcExpandAround, children:newChildren, argNames:node.argNames};
	else
		SWYM.LogError(0, "Fsckup: invalid node for CloneNode");
}

SWYM.ConsiderOmittedStart = function(leftTerm, rightTerm)
{
	// This handles a specific type of sequence at a particular point in the processing.
	// leftTerm = (single term; then term|op|whatever); rightTerm = term|op|whatever.
	// e.g. 1, 1/2, 1/4, etc   or   10, 10+1, 10+2, etc
	if( leftTerm.etcExpandAround === undefined )
		return false;

	var omittedIdx = -1;
	var omittedValue = null;
	if ( leftTerm.op.text === "*" || (leftTerm.op.text === "/" && leftTerm.etcExpandAround === 0) )
	{
		omittedIdx = 1-leftTerm.etcExpandAround;
		omittedValue = 1;
	}
	else if ( leftTerm.op.text === "+" || (leftTerm.op.text === "-" && leftTerm.etcExpandAround === 0) )
	{
		omittedIdx = 1-leftTerm.etcExpandAround;
		omittedValue = 0;
	}
	
	if( omittedIdx === -1 )
		return false;
					
	var omittedLhs = leftTerm.children[omittedIdx];
	var omittedRhs = rightTerm.children[omittedIdx];
	if ( omittedLhs && omittedLhs.type === "literal" && omittedRhs && omittedRhs.type === "literal" )
	{
		var newChildren = [];
		for( var Idx = 0; Idx < leftTerm.children.length; Idx++ )
		{
			if( Idx !== omittedIdx )
			{
				newChildren.push(leftTerm.children[Idx]);
			}
			else
			{
				var newChild = {
					type:"literal",
					text:""+omittedValue+"/"+leftTerm.children[Idx].text+"/"+rightTerm.children[Idx].text,
					etcSequence:[omittedValue]
				};

				if( leftTerm.children[Idx].etcSequence )
					newChild.etcSequence = newChild.etcSequence.concat(leftTerm.children[Idx].etcSequence);
				else
					newChild.etcSequence.push(leftTerm.children[Idx].value);
				
				newChild.etcSequence.push(rightTerm.children[Idx].value);
				
				newChildren.push(newChild);
			}
		}

		//NB this intentionally discards the node's "etcExpandAround" tag.
		return {type:"node",text:leftTerm.text,op:leftTerm.op, children:newChildren};
	}

	return false;
}

// nth should be the example number, or "finalExample", or "finalExampleExcluded".
SWYM.MergeEtc = function(leftTerm, rightTerm, nth, etcId)
{
	if( !leftTerm || !rightTerm )
		return false;
		
	if( leftTerm.etcExpandAround !== undefined && nth === 0 )
	{
		// this is an expanding operator (e.g. 'x, x*2, x*2*2, etc'), so when we backtrack to the first term,
		// it doesn't actually exist
		var matchChild = SWYM.MergeEtc(leftTerm.children[leftTerm.etcExpandAround], rightTerm, nth, etcId);
		if( matchChild === leftTerm.children[leftTerm.etcExpandAround] )
		{
			return leftTerm;
		}
		else
		{
			var cloned = SWYM.CloneNode(leftTerm);
			cloned.children[leftTerm.etcExpandAround] = matchChild;
			return cloned;
		}
	}

	var baseMatch = SWYM.EtcMatchesExceptChildren(leftTerm, rightTerm);
	if ( baseMatch )
	{
		// recurse to merge the children
		if( rightTerm.type === "node" || rightTerm.type === "fnnode" ) // and by implication, leftTerm is a node too (because they matched)
		{
			var newChildren = [];
			for( var Idx = 0; Idx < rightTerm.children.length; Idx++ )
			{
				var mergeResult;

				if ( leftTerm.etcExpandAround === Idx && nth > 1 )
				{
					// if the expression expands around this child, that means this child on the right hand side
					// should match the entire left hand side
					if ( !SWYM.EtcMatches(leftTerm, SWYM.MergeEtc(leftTerm, rightTerm.children[Idx], nth-1, etcId)))
						return false;
					
					// bizarre Firefox bug!? - if I don't use a temp variable here,
					// we get an undefined mergeResult.
					var huh = leftTerm;
					mergeResult = huh.children[Idx];
				}
				else if ( leftTerm.etcExpandAround !== undefined && nth >= 0 )
				{
					// if the expression expands around another child, that means this term gets appended at
					// each iteration. Merge this with previous appended terms.
					mergeResult = SWYM.MergeEtc(leftTerm.children[Idx], rightTerm.children[Idx], nth-1, etcId);
				}
				else if ( leftTerm.children[Idx] === undefined && rightTerm.children[Idx] === undefined )
				{
					mergeResult = undefined;
				}
				else
				{
					mergeResult = SWYM.MergeEtc(leftTerm.children[Idx], rightTerm.children[Idx], nth, etcId);
				}
				
				if( mergeResult === false )
				{
					if ( leftTerm.etcExpandAround !== undefined && nth === 2 )
						return SWYM.ConsiderOmittedStart(leftTerm, rightTerm);
					else
						return false; // can't merge
				}
				if( mergeResult !== leftTerm.children[Idx] )
				{
					newChildren[Idx] = mergeResult;
				}
			}
			
			if ( newChildren.length > 0 )
			{
				for ( var Idx = 0; Idx < leftTerm.children.length; Idx++ )
				{
					if ( !newChildren[Idx] )
						newChildren[Idx] = leftTerm.children[Idx];
				}

				// differences in children - make a new node
				return SWYM.CloneNode(leftTerm, newChildren);
			}
		}
		else if ( baseMatch !== true )
		{
			// a partially matched literal
			var etcSequence = [];
			var oldSeq = leftTerm.etcSequence;
			
			if ( oldSeq )
			{
				for(var elem in oldSeq)
					etcSequence.push(oldSeq[elem]);
			}
			else if ( nth === 0 || nth > 1 )
			{
				// can only start a new etcSequence when nth == 1
				// (i.e. when we're seeing the second term of the sequence)
				return false;
			}
			else
			{
				etcSequence.push(leftTerm.value);
			}

			if( nth === "finalExample" )
			{
				etcSequence.finalExample = rightTerm.value;
				etcSequence.excludeFinalExample = false;
			}
			else if( nth === "finalExampleExcluded" )
			{
				etcSequence.finalExample = rightTerm.value;
				etcSequence.excludeFinalExample = true;
			}
			else
			{
				etcSequence.push(rightTerm.value);
			}
				
			return {type:"literal", text:leftTerm.text+"/"+rightTerm.text, etcSequence:etcSequence, etcId:etcId};
		}

		// matched perfectly, just use the existing node
		return rightTerm;
	}
	
	if( rightTerm.type === "node" || rightTerm.type === "fnnode" )
	{
		// parentheses have no effect and can be ignored
		if( rightTerm.op && rightTerm.op.text === "(parentheses())" )
		{
			return SWYM.MergeEtc(leftTerm, rightTerm.children[0], nth, etcId);
		}

		// we're matching a single value with a node; rightTerm must have been spliced in, or else can't match

		// this kind of splice is only legal if we do it in the first step
		if( nth !== 1 )
			return false;
			
		var BestIdx = SWYM.EtcFindBestMatch(leftTerm, rightTerm.children);
		if ( BestIdx === -1 )
		{
			return false;
		}
		else
		{
			var newChildren = [];
			for( var Idx = 0; Idx < rightTerm.children.length; Idx++ )
			{
//				newChildren[Idx] = rightTerm.children[Idx];
				newChildren[Idx] = SWYM.MergeEtc(leftTerm, rightTerm.children[Idx], nth, etcId);
			}
//			newChildren[BestIdx] = SWYM.MergeEtc(leftTerm, rightTerm.children[BestIdx], nth, etcId);
			if( rightTerm.type === "node" )
			{
				return {type:"node",
					pos:rightTerm.pos,
					identity:rightTerm.identity,
					text:rightTerm.text,
					op:rightTerm.op,
					children:newChildren,
					etcExpandAround:BestIdx,
					etcId:etcId};
			}
			else // rightTerm.type === "fnnode"
			{
				return {type:"fnnode",
					pos:rightTerm.pos,
					identity:rightTerm.identity,
					name:rightTerm.name,
					argNames:rightTerm.argNames,
					children:newChildren,
					etcExpandAround:BestIdx,
					etcId:etcId};
			}
		}
	}

	return false;
}

SWYM.HALT_AFTER = 2;
SWYM.HALT_BEFORE = 1;
SWYM.HALT_NO = 0;

SWYM.HaltCondition = function(test, haltValue)
{
	return function(currentValue, terminatorValue, currentIndex)
	{
		var c = test(currentValue, terminatorValue);
		if ( c && c.value )
			return haltValue;
		else
			return SWYM.HALT_NO;
	}
}

SWYM.CollectEtc = function(parsetree, etcOp, etcId)
{
	if( !etcOp )
		return parsetree;
	
	var collected = {op:etcOp, examples:[], afterEtc:false, finalExample:[]};
	
	if( etcOp.children && etcOp.children[1] !== undefined )
	{
		collected.finalExample.push(etcOp.children[1]);
	}
	
	if( etcOp === parsetree )
	{
		// left-associative op: the etc node is the root, and its left child is the examples
		SWYM.CollectEtcRec(parsetree.children[0], collected);
	}
	else
	{
		// right-associative op: the node we found is the root, and its right child contains the etcOp 
		SWYM.CollectEtcRec(parsetree, collected);
	}
	
	if( collected.examples.length < 1 || collected.examples.length > 4 )
	{
		// we allow 1-4 terms before
		SWYM.LogError(parsetree.pos, "Invalid number of terms before "+etcOp.etc+" (allowed 1-4 terms, got "+collected.examples.length+")");
	}
	else if (etcOp.etc === 'etc' && collected.finalExample.length !== 0)
	{
		SWYM.LogError(parsetree.pos, "Cannot have additional terms after "+etcOp.etc+" expression");
	}
	else if (etcOp.etc !== 'etc' && etcOp.etc !== 'etc..' && collected.finalExample.length !== 1)
	{
		SWYM.LogError(parsetree.pos, "Fsckup: Invalid number of final examples for "+etcOp.etc+" expression (required 1, got "+collected.finalExample.length+")");
	}
	else if (collected.finalExample.length > 1)
	{
		SWYM.LogError(parsetree.pos, "Too many additional terms after "+etcOp.etc+" expression (required 1, got "+collected.finalExample.length+")");
	}
	else
	{
		var result = collected.examples[0];
		for( var Idx = 1; Idx < collected.examples.length; Idx++ )
		{
			result = SWYM.MergeEtc(result, collected.examples[Idx], Idx, etcId);
		}

		if ( !result )
		{
			SWYM.LogError(parsetree.pos, "Failed to extrapolate etc sequence for "+parsetree);
		}
				
		// check for nested etc expressions
		//result = SWYM.FindAndProcessEtc(result, etcId+1);
			
		return {type:"etc", op:etcOp, body:result, rhs:collected.finalExample[0], etcId:etcId};
	}
}

SWYM.CollectEtcRec = function(parsetree, resultSoFar)
{
	if( !parsetree )
		return;
		
	if( (parsetree.type === "node" && parsetree.op.text === resultSoFar.op.text) ||
		(resultSoFar.op.type === "fnnode" && parsetree.name === resultSoFar.op.name))
	{
		for( var Idx = 0; Idx < parsetree.children.length; Idx++ )
		{			
			SWYM.CollectEtcRec(parsetree.children[Idx], resultSoFar);
		}

		if((parsetree.op && parsetree.op.etc) || (parsetree.type === "fnnode" && parsetree.etc))
		{
			if( resultSoFar.afterEtc )
				SWYM.LogError(parsetree.pos, "Cannot have more than one etc per sequence!");

			if( parsetree.op && parsetree.op.etc === "etc" )
				resultSoFar.stopCollecting = true;
			else if( parsetree.type === "fnnode" && parsetree.etc === "etc" )
				resultSoFar.stopCollecting = true;

			resultSoFar.afterEtc = true;
		}
	}
	else if ( parsetree.type === "etc" )
	{
		// ignore it
	}
	else if ( resultSoFar.stopCollecting )
	{
		SWYM.LogError(parsetree.pos, "Cannot have more than one etc per sequence!");
	}
	else
	{
		resultSoFar.examples.push(parsetree);
	}
}

SWYM.FindAndProcessEtcRec = function(parsetree, etcId)
{
	if( !parsetree )
		return;

	if( parsetree.type === "node" || parsetree.type === "fnnode" )
	{
		if( parsetree.etc )
			return parsetree;
		else if(parsetree.op && parsetree.op.etc)
			return parsetree.op; //found an etc node! Notify the caller.

		var etcOp;
		for( var Idx = 0; Idx < parsetree.children.length; Idx++ )
		{
			etcOp = SWYM.FindAndProcessEtcRec(parsetree.children[Idx], etcId);
			if ( etcOp )
			{
				if( parsetree.op && etcOp.text === parsetree.op.text )
				{
					// this continues an etc node! Notify the caller.
					return etcOp;
				}
				else if ( parsetree.type === "fnnode" && etcOp.name === parsetree.name)
				{
					// this continues an etc function! Notify the caller.
					return etcOp;
				}
				else
				{
					// we have found the limit of this whole etc - now process it.
					parsetree.children[Idx] = SWYM.CollectEtc(parsetree.children[Idx], etcOp, etcId);
				}
			}
		}
		
		if( parsetree.body )
		{
			parsetree.body = SWYM.CollectEtc(parsetree.body, SWYM.FindAndProcessEtcRec(parsetree.body, etcId), etcId);
		}
	}
}

SWYM.FindAndProcessEtc = function(parsetree, etcId)
{
	var etcOp = SWYM.FindAndProcessEtcRec(parsetree, etcId);
	if( etcOp )
		return SWYM.CollectEtc(parsetree, etcOp, etcId);
	else
		return parsetree;
}

SWYM.EtcTryGenerator = function(sequence, generator)
{  
	for(var Idx = 0; Idx < sequence.length; Idx++ )
	{
		var resultAtIdx = generator(Idx);
		if( resultAtIdx + 0.0000000001 < sequence[Idx] || resultAtIdx - 0.0000000001 > sequence[Idx] )
			return false;
	}
	
	return true;
}

SWYM.EtcCreateGenerator = function(sequence)
{
	var base = sequence[0];

	if( sequence.length === 1 )
	{
		sequence.integer = base%1==0;
		
		if( sequence.finalExample !== undefined && sequence.finalExample < base )
		{
			sequence.direction = "descending";
			return function(index){ return base - index; };
		}
		else
		{
			sequence.direction = "ascending";
			return function(index){ return base + index; };
		}
	}
		
	var second = sequence[1];
	var arithmetic = function(index){ return base + (second-base)*index; };
	
	// this will match all 2-element sequences.
	if ( SWYM.EtcTryGenerator(sequence, arithmetic) )
	{
		if( second > base )
			sequence.direction = "ascending";
		else if ( second < base )
			sequence.direction = "descending";
			
		sequence.integer = base%1==0 && second%1==0;

		return arithmetic;
	}

	if (base != 0 )
	{
		var geometric = function(index){ return base * Math.pow(second/base, index); };

		if (SWYM.EtcTryGenerator(sequence, geometric ))
		{
			if( second > base )
				sequence.direction = "ascending";
			else if ( second < base )
				sequence.direction = "descending";
				
			sequence.integer = base%1==0 && (second/base)%1==0;
			
			return geometric;
		}
	}
	
	var third = sequence[2];
	var firstDiff = second-base;
	
	if( sequence.length >= 4 )
	{	
		// try a quadratic sequence, e.g. 1, 3, 7, 10
		// only try this when there are 4 examples, because literally all 3-value sequences can fit a quadratic sequence.
		// - which would make it impossible to detect when someone made a mistake in an arithmetic or geometric sequence.
		var firstDiff = second-base;
		var pDiff = (third-second) - firstDiff;
		var quadratic = function(index){
			return base + firstDiff*index + pDiff*index*(index-1)/2;
		};

		if (SWYM.EtcTryGenerator(sequence, quadratic))
		{
			if( firstDiff >= 0 && pDiff >= 0 )
				sequence.direction = "ascending";
			else if ( firstDiff <= 0 && pDiff <= 0 )
				sequence.direction = "descending";
				
			sequence.integer = base%1==0 && firstDiff%1==0 && pDiff%1==0;

			return quadratic;
		}

		var factor = (third-second) / firstDiff;
		var lastIndex = 0;
		var lastValue = base;

		// last resort: try a cumulative geometric sequence, e.g. 0, 0.1, 0.11, 0.111, etc
		// feels like there should be a simpler way to generate it than this. :-/
		// also, doing it this way accumulates some nasty floating point errors.
		var cumgeometric = function(index)
		{
			if( lastIndex > index )
			{
				lastIndex = 0;
				lastValue = base;
			}
			
			while( lastIndex < index )
			{
				lastValue += firstDiff*Math.pow(factor, lastIndex);
				lastIndex++;
			}
			return lastValue;
		};

		if (SWYM.EtcTryGenerator(sequence, cumgeometric))
		{
			if( factor > 0 )
			{
				if( firstDiff > 0 )
					sequence.direction = "ascending";
				else if ( firstDiff < 0 )
					sequence.direction = "descending";
			}
				
			sequence.integer = base%1==0 && firstDiff%1==0 && factor%1==0;

			return cumgeometric;
		}
	}
   	
	if( sequence.length < 4 )
	{
		SWYM.LogError(0, "etc - can't find a rule for sequence ["+sequence+"]. (For a quadratic sequence, give at least 4 examples.)");
	}
	else
	{
		SWYM.LogError(0, "etc - can't find a rule for sequence ["+sequence+"].");
	}
   	return undefined;
}

SWYM.ResolveEtcSequence = function(sequence, index)
{
	if( sequence.length > index )
		return sequence[index];
	
	if (!sequence.generator)
	{
		var genOffset = 0;
		for( var Idx = 0; Idx < sequence.length; Idx++ )
		{
			if ( sequence[Idx] !== undefined )
			{
				genOffset = Idx;
				break;
			}
		}
		sequence.generator = SWYM.EtcCreateGenerator(sequence.slice(genOffset, sequence.length));
		if ( !sequence.generator )
		{
			SWYM.LogError(0, "Unable to find a rule that generates sequence "+sequence);
			return undefined;
		}
		
		if( genOffset > 0 )
		{
			var oldGen = sequence.generator;
			sequence.generator = function(index) { return oldGen(index-genOffset); };
		}
	}

	var result = sequence.generator(index);
	var outOfBounds = false;

	// check for the end of the sequence
	if( result !== undefined && sequence.maxIndex === undefined && sequence.finalExample !== undefined )
	{
		if( result === sequence.finalExample )
		{
			if( sequence.excludeFinalExample )
			{
				sequence.maxIndex = index-1;
				outOfBounds = true;
			}
			else
			{
				sequence.maxIndex = index;
			}
		}
		else if ( (sequence.direction === "ascending" && result > sequence.finalExample) ||
				(sequence.direction === "descending" && result < sequence.finalExample))
		{
			outOfBounds = true;
		}
	}

	if( outOfBounds || (sequence.maxIndex !== undefined && index > sequence.maxIndex) )
	{
		if ( SWYM.scope["#outOfBoundsFlag"].value === false )
			SWYM.scope["#outOfBoundsFlag"].value = true;
		
		return null;
	}

	return result;
}