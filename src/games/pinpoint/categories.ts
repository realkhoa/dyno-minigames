/**
 * Hand-written Pinpoint categories.
 *
 * Five member clues share one category; the player names it. Answers are
 * matched against the title plus a few aliases, ignoring case and punctuation.
 */

export interface PinpointCategory {
  answer: string;
  aliases: string[];
  clues: [string, string, string, string, string];
}

export const PINPOINT_CATEGORIES: PinpointCategory[] = [
  {
    answer: "Fruits",
    aliases: ["fruit"],
    clues: ["Apple", "Banana", "Mango", "Cherry", "Peach"],
  },
  {
    answer: "Musical instruments",
    aliases: ["instruments", "musical instrument", "music instruments"],
    clues: ["Piano", "Guitar", "Violin", "Drum", "Flute"],
  },
  {
    answer: "Planets",
    aliases: ["planet", "solar system planets"],
    clues: ["Mars", "Venus", "Jupiter", "Saturn", "Mercury"],
  },
  {
    answer: "US states",
    aliases: ["states", "american states", "united states", "us state"],
    clues: ["Texas", "Ohio", "Nevada", "Oregon", "Kansas"],
  },
  {
    answer: "Capital cities",
    aliases: ["capitals", "capital city", "world capitals"],
    clues: ["Paris", "Tokyo", "Cairo", "Lima", "Ottawa"],
  },
  {
    answer: "Mammals",
    aliases: ["mammal"],
    clues: ["Tiger", "Rabbit", "Camel", "Horse", "Bat"],
  },
  {
    answer: "Programming languages",
    aliases: ["coding languages", "programming language", "coding language"],
    clues: ["Python", "Java", "Rust", "Kotlin", "Ruby"],
  },
  {
    answer: "Coffee drinks",
    aliases: ["coffee", "espresso drinks", "coffee drink"],
    clues: ["Latte", "Mocha", "Espresso", "Americano", "Cappuccino"],
  },
  {
    answer: "Board games",
    aliases: ["board game"],
    clues: ["Chess", "Monopoly", "Scrabble", "Clue", "Risk"],
  },
  {
    answer: "Greek letters",
    aliases: ["greek alphabet", "greek letter"],
    clues: ["Alpha", "Beta", "Gamma", "Delta", "Omega"],
  },
  {
    answer: "Chemical elements",
    aliases: ["elements", "periodic table", "chemical element"],
    clues: ["Oxygen", "Carbon", "Iron", "Gold", "Neon"],
  },
  {
    answer: "Things with wheels",
    aliases: ["wheeled vehicles", "vehicles", "things on wheels"],
    clues: ["Bicycle", "Car", "Skateboard", "Wagon", "Bus"],
  },
  {
    answer: "Citrus fruits",
    aliases: ["citrus", "citrus fruit", "citrus fruits"],
    clues: ["Lemon", "Lime", "Orange", "Grapefruit", "Tangerine"],
  },
  {
    answer: "Spices",
    aliases: ["spice", "herbs and spices"],
    clues: ["Cinnamon", "Paprika", "Cumin", "Oregano", "Basil"],
  },
  {
    answer: "Dinosaurs",
    aliases: ["dinosaur"],
    clues: ["T-Rex", "Triceratops", "Velociraptor", "Stegosaurus", "Brachiosaurus"],
  },
  {
    answer: "Continents",
    aliases: ["continent"],
    clues: ["Asia", "Europe", "Africa", "Australia", "Antarctica"],
  },
  {
    answer: "NBA teams",
    aliases: ["basketball teams", "nba", "nba team"],
    clues: ["Lakers", "Celtics", "Bulls", "Warriors", "Knicks"],
  },
  {
    answer: "Ice cream flavours",
    aliases: ["ice cream flavors", "ice cream", "flavors", "flavours"],
    clues: ["Vanilla", "Chocolate", "Strawberry", "Mint", "Mango"],
  },
  {
    answer: "Tools",
    aliases: ["hand tools", "toolbox tools"],
    clues: ["Hammer", "Wrench", "Screwdriver", "Pliers", "Drill"],
  },
  {
    answer: "Playing cards",
    aliases: ["cards", "card ranks", "playing card"],
    clues: ["Ace", "King", "Queen", "Jack", "Joker"],
  },
  {
    answer: "Dog breeds",
    aliases: ["dogs", "dog breed", "dog"],
    clues: ["Labrador", "Poodle", "Beagle", "Husky", "Bulldog"],
  },
  {
    answer: "Ocean animals",
    aliases: ["sea animals", "marine animals", "ocean animal"],
    clues: ["Shark", "Octopus", "Jellyfish", "Dolphin", "Whale"],
  },
  {
    answer: "Famous painters",
    aliases: ["painters", "artists", "famous artists"],
    clues: ["Picasso", "Monet", "Van Gogh", "Dali", "Rembrandt"],
  },
  {
    answer: "Pizza toppings",
    aliases: ["toppings", "pizza topping"],
    clues: ["Pepperoni", "Mushroom", "Olive", "Onion", "Cheese"],
  },
  {
    answer: "Italian foods",
    aliases: ["italian food", "italian dishes", "italian cuisine"],
    clues: ["Pizza", "Pasta", "Risotto", "Lasagna", "Tiramisu"],
  },
  {
    answer: "Things that fly",
    aliases: ["flying things", "things in the air"],
    clues: ["Airplane", "Bird", "Helicopter", "Rocket", "Balloon"],
  },
  {
    answer: "Units of measurement",
    aliases: ["units", "measurement units", "unit of measurement"],
    clues: ["Meter", "Kilogram", "Second", "Liter", "Celsius"],
  },
  {
    answer: "Superheroes",
    aliases: ["superhero", "marvel heroes", "avengers", "marvel characters"],
    clues: ["Spider-Man", "Iron Man", "Thor", "Hulk", "Captain America"],
  },
  {
    answer: "Kitchen appliances",
    aliases: ["appliances", "kitchen appliance"],
    clues: ["Oven", "Fridge", "Blender", "Kettle", "Toaster"],
  },
  {
    answer: "Weather",
    aliases: ["weather types", "types of weather", "precipitation"],
    clues: ["Rain", "Snow", "Fog", "Storm", "Hail"],
  },
  {
    answer: "Tech companies",
    aliases: ["technology companies", "tech giants", "software companies"],
    clues: ["Microsoft", "Google", "Apple", "Amazon", "Meta"],
  },
  {
    answer: "Ball sports",
    aliases: ["sports", "ball games", "sport"],
    clues: ["Soccer", "Basketball", "Tennis", "Golf", "Baseball"],
  },
];
