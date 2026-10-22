/**
 * Hand-written Crossclimb puzzles.
 *
 * Five five-letter words form a ladder: each rung differs from the one above
 * by exactly one letter. The first and last are given; the middle three are
 * clued. Answers are checked exactly, so clues are written to be unambiguous.
 */

export interface CrossclimbPuzzle {
  words: [string, string, string, string, string];
  /** Clues for the three middle words. */
  clues: [string, string, string];
  /** Clues for the given top and bottom words. */
  endClues: [string, string];
}

export const CROSSCLIMB_PUZZLES: CrossclimbPuzzle[] = [
  {
    words: ["COLD", "CORD", "CARD", "WARD", "WARM"],
    clues: ["Thick string or rope", "Birthday ___", "A room in a hospital"],
    endClues: ["Low temperature", "Not cold"],
  },
  {
    words: ["HEAD", "HEAL", "TEAL", "TELL", "TALL"],
    clues: ["To become healthy again", "Blue-green colour", "To say something"],
    endClues: ["Body part above the neck", "Not short"],
  },
  {
    words: ["BONE", "BORE", "BARE", "BARN", "BORN"],
    clues: ["To drill a hole", "Without covering", "Farm building"],
    endClues: ["Skeleton part", "Brought into life"],
  },
  {
    words: ["LINE", "LANE", "LAND", "SAND", "SEND"],
    clues: ["A narrow road", "Ground or country", "Beach material"],
    endClues: ["A straight mark", "To post a letter"],
  },
  {
    words: ["WEST", "BEST", "BEAT", "BOAT", "COAT"],
    clues: ["Superior to all others", "To hit repeatedly", "A small vessel"],
    endClues: ["Opposite of east", "Worn for warmth"],
  },
  {
    words: ["LATE", "DATE", "DARE", "DARK", "MARK"],
    clues: ["A calendar day", "To be brave enough", "Without light"],
    endClues: ["Not on time", "A spot or stain"],
  },
  {
    words: ["MIND", "MINE", "MINT", "MIST", "MUST"],
    clues: ["Where coal is dug", "A fresh herb", "Light fog"],
    endClues: ["The thinking part", "Have to"],
  },
  {
    words: ["FIRE", "FINE", "FIND", "FOND", "FOLD"],
    clues: ["Of good quality", "To discover", "To like very much"],
    endClues: ["Flames", "To bend over itself"],
  },
  {
    words: ["ROCK", "SOCK", "SACK", "BACK", "BANK"],
    clues: ["Clothing for the foot", "A large bag", "Rear part"],
    endClues: ["A stone", "Where money is kept"],
  },
  {
    words: ["WALL", "WELL", "BELL", "BELT", "BOLT"],
    clues: ["In a good way", "It rings", "Worn around the waist"],
    endClues: ["Side of a room", "A metal fastener"],
  },
  {
    words: ["HOST", "MOST", "MOAT", "MEAT", "MEAL"],
    clues: ["The greatest amount", "Water around a castle", "Food from an animal"],
    endClues: ["Person who invites guests", "Breakfast, lunch or dinner"],
  },
  {
    words: ["GAME", "GATE", "RATE", "RACE", "RICE"],
    clues: ["An entrance", "A price or speed", "A speed competition"],
    endClues: ["Play with rules", "A grain"],
  },
  {
    words: ["COAT", "COST", "CAST", "CASE", "BASE"],
    clues: ["The price of something", "To throw", "A container"],
    endClues: ["Worn for warmth", "The bottom support"],
  },
  {
    words: ["PALE", "PILE", "PINE", "PINT", "PANT"],
    clues: ["A heap", "An evergreen tree", "A beer measure"],
    endClues: ["Light in colour", "To breathe heavily"],
  },
  {
    words: ["WIND", "WINE", "WIDE", "WADE", "WARE"],
    clues: ["A drink from grapes", "Broad", "To walk through water"],
    endClues: ["Moving air", "Goods for sale"],
  },
  {
    words: ["BAND", "BEND", "BENT", "BEST", "REST"],
    clues: ["To curve", "Not straight", "Superior to all others"],
    endClues: ["A music group", "To relax"],
  },
];
