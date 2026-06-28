/**
 * Real EuroLeague player rosters for the 8 clubs in the game.
 * Players are drawn from 2022-2025 EuroLeague seasons.
 * Used by makeSampleTeam to assign authentic names and nationalities.
 */

import type { Position } from "../types.js";

export interface RosterEntry {
  firstName: string;
  lastName: string;
  /** ISO-3166 alpha-3 country code, e.g. "ESP". */
  nationality: string;
  position: Position;
}

export const REAL_ROSTERS: Record<string, RosterEntry[]> = {
  RMB: [
    // Real Madrid
    { firstName: "Sergio",    lastName: "Llull",                  nationality: "ESP", position: "PG" },
    { firstName: "Facundo",   lastName: "Campazzo",               nationality: "ARG", position: "PG" },
    { firstName: "Dzanan",    lastName: "Musa",                   nationality: "BIH", position: "SG" },
    { firstName: "Rudy",      lastName: "Fernandez",              nationality: "ESP", position: "SG" },
    { firstName: "Mario",     lastName: "Hezonja",                nationality: "HRV", position: "SF" },
    { firstName: "Gabriel",   lastName: "Deck",                   nationality: "ARG", position: "SF" },
    { firstName: "Guerschon", lastName: "Yabusele",               nationality: "FRA", position: "PF" },
    { firstName: "Tristan",   lastName: "Vukcevic",               nationality: "SRB", position: "PF" },
    { firstName: "Edy",       lastName: "Tavares",                nationality: "CPV", position: "C"  },
    { firstName: "Carlos",    lastName: "Alocen",                 nationality: "ESP", position: "PG" },
    { firstName: "Alberto",   lastName: "de la Cruz",             nationality: "ESP", position: "SG" },
    { firstName: "Vincent",   lastName: "Poirier",                nationality: "FRA", position: "C"  },
  ],
  FCB: [
    // FC Barcelona
    { firstName: "Nikola",    lastName: "Mirotic",                nationality: "MNE", position: "PF" },
    { firstName: "Rokas",     lastName: "Jokubaitis",             nationality: "LTU", position: "PG" },
    { firstName: "Tomas",     lastName: "Satoransky",             nationality: "CZE", position: "PG" },
    { firstName: "Alex",      lastName: "Abrines",                nationality: "ESP", position: "SG" },
    { firstName: "Dario",     lastName: "Brizuela",               nationality: "ESP", position: "SG" },
    { firstName: "Jabari",    lastName: "Parker",                 nationality: "USA", position: "SF" },
    { firstName: "Brandon",   lastName: "Davies",                 nationality: "USA", position: "PF" },
    { firstName: "Cory",      lastName: "Higgins",                nationality: "USA", position: "SG" },
    { firstName: "Willy",     lastName: "Hernangomez",            nationality: "ESP", position: "C"  },
    { firstName: "Joel",      lastName: "Parra",                  nationality: "ESP", position: "SF" },
    { firstName: "Nikola",    lastName: "Calathes",               nationality: "GRC", position: "PG" },
    { firstName: "Sergi",     lastName: "Martinez",               nationality: "ESP", position: "C"  },
  ],
  MTA: [
    // Maccabi Tel Aviv
    { firstName: "Wade",      lastName: "Baldwin",                nationality: "USA", position: "PG" },
    { firstName: "Scottie",   lastName: "Wilbekin",               nationality: "USA", position: "PG" },
    { firstName: "Lorenzo",   lastName: "Brown",                  nationality: "USA", position: "PG" },
    { firstName: "Elijah",    lastName: "Bryant",                 nationality: "USA", position: "SG" },
    { firstName: "Jordan",    lastName: "Loyd",                   nationality: "USA", position: "SG" },
    { firstName: "Angelo",    lastName: "Caloiaro",               nationality: "ISR", position: "SF" },
    { firstName: "Deni",      lastName: "Avdija",                 nationality: "ISR", position: "SF" },
    { firstName: "Ante",      lastName: "Zizic",                  nationality: "HRV", position: "PF" },
    { firstName: "Dragan",    lastName: "Bender",                 nationality: "HRV", position: "PF" },
    { firstName: "Josh",      lastName: "Nebo",                   nationality: "USA", position: "C"  },
    { firstName: "Jalen",     lastName: "Harris",                 nationality: "USA", position: "SG" },
    { firstName: "John",      lastName: "DiBartolomeo",           nationality: "ISR", position: "PG" },
  ],
  OLY: [
    // Olympiacos
    { firstName: "Sasha",      lastName: "Vezenkov",              nationality: "BGR", position: "SF" },
    { firstName: "Shaquille",  lastName: "Harrison",              nationality: "USA", position: "PG" },
    { firstName: "Thomas",     lastName: "Walkup",                nationality: "USA", position: "PG" },
    { firstName: "Giannoulis", lastName: "Larentzakis",           nationality: "GRC", position: "SG" },
    { firstName: "Jalen",      lastName: "Adams",                 nationality: "USA", position: "SG" },
    { firstName: "Kostas",     lastName: "Papanikolaou",          nationality: "GRC", position: "SF" },
    { firstName: "DeShawn",    lastName: "Stevenson",             nationality: "USA", position: "SF" },
    { firstName: "Moustapha",  lastName: "Fall",                  nationality: "FRA", position: "C"  },
    { firstName: "Nikola",     lastName: "Milutinov",             nationality: "SRB", position: "C"  },
    { firstName: "Nigel",      lastName: "Williams-Goss",         nationality: "USA", position: "PG" },
    { firstName: "Georgios",   lastName: "Printezis",             nationality: "GRC", position: "SF" },
    { firstName: "Alexandros", lastName: "Mourant",               nationality: "GRC", position: "PF" },
  ],
  PAO: [
    // Panathinaikos
    { firstName: "Georgios",   lastName: "Sloukas",               nationality: "GRC", position: "PG" },
    { firstName: "Nikos",      lastName: "Pappas",                nationality: "GRC", position: "SG" },
    { firstName: "Nemanja",    lastName: "Nedovic",               nationality: "SRB", position: "SG" },
    { firstName: "Kendrick",   lastName: "Nunn",                  nationality: "USA", position: "SG" },
    { firstName: "Marius",     lastName: "Grigonis",              nationality: "LTU", position: "SF" },
    { firstName: "Ioannis",    lastName: "Papapetrou",            nationality: "GRC", position: "SF" },
    { firstName: "Mathias",    lastName: "Lessort",               nationality: "FRA", position: "PF" },
    { firstName: "Dinos",      lastName: "Mitoglou",              nationality: "GRC", position: "PF" },
    { firstName: "Georgios",   lastName: "Papagiannis",           nationality: "GRC", position: "C"  },
    { firstName: "Howard",     lastName: "Sant-Roos",             nationality: "FRA", position: "C"  },
    { firstName: "Tyrese",     lastName: "Martin",                nationality: "USA", position: "SF" },
    { firstName: "Georgios",   lastName: "Kalaitzakis",           nationality: "GRC", position: "SG" },
  ],
  FEN: [
    // Fenerbahce Beko
    { firstName: "Jan",        lastName: "Vesely",                nationality: "CZE", position: "C"  },
    { firstName: "Tyler",      lastName: "Ennis",                 nationality: "USA", position: "PG" },
    { firstName: "Marko",      lastName: "Guduric",               nationality: "SRB", position: "SG" },
    { firstName: "Dyshawn",    lastName: "Pierre",                nationality: "CAN", position: "SF" },
    { firstName: "Nigel",      lastName: "Hayes-Davis",           nationality: "USA", position: "PF" },
    { firstName: "Leo",        lastName: "Westermann",            nationality: "FRA", position: "PG" },
    { firstName: "Nando",      lastName: "De Colo",               nationality: "FRA", position: "SG" },
    { firstName: "Joffrey",    lastName: "Lauvergne",             nationality: "FRA", position: "PF" },
    { firstName: "John",       lastName: "Brown III",             nationality: "TUR", position: "PF" },
    { firstName: "Melih",      lastName: "Mahmutoglu",            nationality: "TUR", position: "SG" },
    { firstName: "Ahmet",      lastName: "Can",                   nationality: "TUR", position: "C"  },
    { firstName: "Gigi",       lastName: "Datome",                nationality: "ITA", position: "SF" },
  ],
  PAR: [
    // Partizan Belgrade
    { firstName: "Dante",      lastName: "Exum",                  nationality: "AUS", position: "PG" },
    { firstName: "Frank",      lastName: "Ntilikina",             nationality: "FRA", position: "PG" },
    { firstName: "Aleksa",     lastName: "Avramovic",             nationality: "SRB", position: "PG" },
    { firstName: "Kevin",      lastName: "Punter",                nationality: "USA", position: "SG" },
    { firstName: "Sterling",   lastName: "Brown",                 nationality: "USA", position: "SG" },
    { firstName: "Zach",       lastName: "LeDay",                 nationality: "USA", position: "PF" },
    { firstName: "Trejun",     lastName: "Langley",               nationality: "USA", position: "SF" },
    { firstName: "James",      lastName: "Nunnally",              nationality: "USA", position: "SF" },
    { firstName: "Balsa",      lastName: "Koprivica",             nationality: "MNE", position: "C"  },
    { firstName: "Ognjen",     lastName: "Jaramaz",               nationality: "SRB", position: "SG" },
    { firstName: "Matt",       lastName: "Costello",              nationality: "USA", position: "PF" },
    { firstName: "Vanja",      lastName: "Marinkovic",            nationality: "SRB", position: "SG" },
  ],
  BAY: [
    // Bayern Munich
    { firstName: "Isaac",      lastName: "Bonga",                 nationality: "GER", position: "PG" },
    { firstName: "Nick",       lastName: "Weiler-Babb",           nationality: "USA", position: "SG" },
    { firstName: "Carsen",     lastName: "Edwards",               nationality: "USA", position: "PG" },
    { firstName: "Vladimir",   lastName: "Lucic",                 nationality: "SRB", position: "SF" },
    { firstName: "Othman",     lastName: "Zoleihat",              nationality: "GER", position: "PF" },
    { firstName: "Deshaun",    lastName: "Thomas",                nationality: "USA", position: "SF" },
    { firstName: "Augustine",  lastName: "Rubit",                 nationality: "USA", position: "PF" },
    { firstName: "Leon",       lastName: "Kratzer",               nationality: "GER", position: "C"  },
    { firstName: "Jalen",      lastName: "Reynolds",              nationality: "USA", position: "C"  },
    { firstName: "Luczo",      lastName: "Barford",               nationality: "SWE", position: "PG" },
    { firstName: "Paul",       lastName: "Zipser",                nationality: "GER", position: "SF" },
    { firstName: "Jonas",      lastName: "Wohlfarth-Bottermann",  nationality: "GER", position: "C"  },
  ],
};
