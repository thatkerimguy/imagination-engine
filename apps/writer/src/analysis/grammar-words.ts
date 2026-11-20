// Closed-class English function words ("grammar words"): everything else counts as content.
// Used for lexical density and the Frequency tab's Content / Grammar filters.
const WORDS = `
a an the this that these those some any each every either neither no another such
i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves one ones who whom whose
which what whatever whoever whichever
of in on at by for with about against between into through during before after above below to
from up down out off over under again further onto upon within without toward towards across
along among around behind beyond near past since until till via per than
and but or nor so yet for because although though while whereas if unless whether as once
when where whenever wherever why how
am is are was were be been being have has had having do does did doing done
will would shall should can could may might must ought
not too very just also only even still then there here now ever never always already
all both few many more most much other others several own same
yes oh
nobody nothing somebody something someone anyone anybody anything everyone everybody everything
somewhere anywhere everywhere nowhere else inside outside
don't doesn't didn't isn't aren't wasn't weren't hasn't haven't hadn't won't wouldn't shan't
shouldn't can't couldn't mustn't mightn't needn't
i'm you're he's she's it's we're they're i've you've we've they've i'd you'd he'd she'd we'd
they'd i'll you'll he'll she'll we'll they'll that's there's here's what's who's let's
let get gets got
`;

export const GRAMMAR_WORDS: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean));

/** Normalises curly apostrophes and case so tokens match the table. */
export const isGrammarWord = (token: string): boolean =>
  GRAMMAR_WORDS.has(token.toLowerCase().replace(/[’‘]/g, "'"));
