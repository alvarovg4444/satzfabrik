import type { GramItem } from "./types";

/**
 * Extra grammar machines for all three grammar halls.
 * GRAMMAR_A1: the basics an A2/B1 learner should refresh now and then.
 * GRAMMAR_B1_EXTRA: B1 structures the main halls don't cover yet.
 */
export const GRAMMAR_A1: GramItem[] = [
  {
    id: "g.artikel",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "Artikel: der, die, das und ein, eine",
    en: "Articles and gender (the, a/an)",
    name: "Artikel: der, die, das",
    cue: "Artikel: der/die/das, ein/eine, kein",
    rule: "Every noun is masculine (der, ein), feminine (die, eine) or neuter (das, ein); in the plural the article is always die, and ein just disappears (ein Kind – Kinder). Use ein/eine for something new or not specific, der/die/das for something specific or already mentioned, and kein/keine for no or not a. Learn every noun with its article; endings help: -ung, -heit, -keit and -ion are feminine, -chen is neuter.",
    pattern: "der/ein + Nomen (m) · die/eine + Nomen (f) · das/ein + Nomen (n) · die + Nomen (Pl.) · nicht ein → kein/keine",
    example: { de: "Die Waschmaschine ist kaputt und der Hausmeister ist im Urlaub.", en: "The washing machine is broken and the caretaker is on holiday." },
    examples: [
      { de: "Die Waschmaschine ist kaputt und der Hausmeister ist im Urlaub.", en: "The washing machine is broken and the caretaker is on holiday." },
      { de: "Entschuldigung, ist das der Bus zum Flughafen?", en: "Excuse me, is this the bus to the airport?" },
      { de: "Hier ist eine Nachricht von Frau Klein: Das Meeting ist erst um zehn.", en: "Here's a message from Ms Klein: the meeting isn't until ten." },
    ],
    translate: [
      { en: "The supermarket is already closed, but the bakery is still open.", de: "Der Supermarkt ist schon zu, aber die Bäckerei ist noch offen." },
      { en: "The flat is great, but the bathroom is really small.", de: "Die Wohnung ist toll, aber das Bad ist wirklich klein." },
      { en: "We've got no milk and no bread left.", de: "Wir haben keine Milch und kein Brot mehr." },
    ],
    transform: [
      {
        prompt: "Ergänze der, die oder das.",
        input: "___ Heizung ist kalt und ___ Fenster geht nicht zu.",
        answer: "Die Heizung ist kalt und das Fenster geht nicht zu.",
      },
      {
        prompt: "Ergänze ein/eine oder der/die/das.",
        input: "Da ist ___ Brief für dich. ___ Brief ist vom Finanzamt.",
        answer: "Da ist ein Brief für dich. Der Brief ist vom Finanzamt.",
      },
    ],
    tip: "Learn each noun with its article („die Wohnung“, not just „Wohnung“) and don't drop the article: „Ich habe eine Frage“, not „Ich habe Frage“.",
    errors: ["gender", "missing_word"],
    keys: ["der", "die", "das", "den", "dem", "des", "ein", "kein"],
  },
  {
    id: "g.praesens",
    kind: "gram",
    hall: "verben",
    level: "A1",
    de: "Präsens: regelmäßige Verben",
    en: "Present tense of regular verbs",
    name: "Präsens: Endungen",
    cue: "Präsens (z. B. du arbeitest, er wohnt)",
    rule: "Take the stem (the infinitive without -en) and add the ending for the person: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en. If the stem ends in -t or -d, add an e before -st and -t (du arbeitest, er findet); if it ends in -s, -ß or -z, the du-form only adds -t (du heißt, du tanzt). The present also works for the future: Morgen arbeite ich länger.",
    pattern: "ich wohn-e · du wohn-st · er/sie/es wohn-t · wir wohn-en · ihr wohn-t · sie/Sie wohn-en · Stamm auf -t/-d: du arbeit-e-st, er arbeit-e-t",
    example: {
      de: "Ich arbeite im Krankenhaus, meine Frau arbeitet bei einer Versicherung.",
      en: "I work at the hospital; my wife works for an insurance company.",
    },
    examples: [
      {
        de: "Ich arbeite im Krankenhaus, meine Frau arbeitet bei einer Versicherung.",
        en: "I work at the hospital; my wife works for an insurance company.",
      },
      {
        de: "Wohnst du noch in Kreuzberg oder schon in der neuen Wohnung?",
        en: "Are you still living in Kreuzberg or already in the new flat?",
      },
      {
        de: "Wie lange wartet ihr schon? – Wir warten seit einer halben Stunde.",
        en: "How long have you been waiting? – We've been waiting for half an hour.",
      },
    ],
    translate: [
      {
        en: "My colleague lives in Potsdam and commutes to Berlin every day.",
        de: "Meine Kollegin wohnt in Potsdam und pendelt jeden Tag nach Berlin.",
      },
      {
        en: "Do you work on Saturdays too?",
        de: "Arbeitest du auch samstags?",
      },
      {
        en: "(to two friends) What are you doing at the weekend?",
        de: "Was macht ihr am Wochenende?",
      },
    ],
    transform: [
      {
        prompt: "Schreib den Satz mit „er“.",
        input: "Ich arbeite heute bis sechs und kaufe danach ein.",
        answer: "Er arbeitet heute bis sechs und kauft danach ein.",
      },
      {
        prompt: "Stell die Frage mit „du“.",
        input: "Arbeiten Sie heute im Homeoffice?",
        answer: "Arbeitest du heute im Homeoffice?",
      },
    ],
    tip: "Match the ending to the subject: „ich wohne, du wohnst, er wohnt“ – not „er wohnen“ or „du wohnt“. After -t or -d add an e: „du arbeitest“, „er findet“.",
    errors: ["verb_form"],
    keys: [],
  },
  {
    id: "g.sein-haben",
    kind: "gram",
    hall: "verben",
    level: "A1",
    de: "sein und haben im Präsens",
    en: "Present tense of sein and haben (to be, to have)",
    name: "sein und haben",
    cue: "sein/haben (ich bin, du hast …)",
    rule: "Sein and haben are irregular, and you need them all the time: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind – ich habe, du hast, er/sie/es hat, wir haben, ihr habt, sie/Sie haben. Where English uses be, German often uses haben: Ich habe Hunger, Durst, Angst, recht (I'm hungry, thirsty, afraid, right). Age goes with sein (Ich bin 34), and for feeling cold or hot say Mir ist kalt or Mir ist warm.",
    pattern: "sein: bin, bist, ist, sind, seid, sind · haben: habe, hast, hat, haben, habt, haben · Hunger/Durst/Angst/Zeit haben",
    example: {
      de: "Ich bin heute im Homeoffice und habe um zehn eine Videokonferenz.",
      en: "I'm working from home today and I've got a video call at ten.",
    },
    examples: [
      {
        de: "Ich bin heute im Homeoffice und habe um zehn eine Videokonferenz.",
        en: "I'm working from home today and I've got a video call at ten.",
      },
      {
        de: "Hast du kurz Zeit? Ich habe eine Frage zum Mietvertrag.",
        en: "Have you got a minute? I've got a question about the rental agreement.",
      },
      {
        de: "Seid ihr schon da? Wir sind in fünf Minuten am Eingang.",
        en: "Are you there already? We'll be at the entrance in five minutes.",
      },
    ],
    translate: [
      {
        en: "My daughter is ill and has a temperature.",
        de: "Meine Tochter ist krank und hat Fieber.",
      },
      {
        en: "Are you hungry? I've still got some pasta and salad.",
        de: "Hast du Hunger? Ich habe noch Nudeln und Salat.",
      },
      {
        en: "We're new here and don't have a car yet.",
        de: "Wir sind neu hier und haben noch kein Auto.",
      },
    ],
    transform: [
      {
        prompt: "Schreib den Satz mit „wir“.",
        input: "Ich bin müde und habe keine Lust auf Kino.",
        answer: "Wir sind müde und haben keine Lust auf Kino.",
      },
      {
        prompt: "Ergänze sein oder haben in der richtigen Form.",
        input: "Mein Chef ___ heute nicht da, er ___ einen Termin beim Zahnarzt.",
        answer: "Mein Chef ist heute nicht da, er hat einen Termin beim Zahnarzt.",
      },
    ],
    tip: "„I'm cold“ is „Mir ist kalt“ („Ich bin kalt“ means you're unfriendly), „I'm hungry“ is „Ich habe Hunger“. Write „ihr seid“ with d – seit means since.",
    errors: ["verb_form", "word_choice"],
    keys: ["bin", "bist", "ist", "sind", "seid", "habe", "hast", "hat", "haben", "habt"],
  },
  {
    id: "g.w-fragen",
    kind: "gram",
    hall: "satzbau",
    level: "A1",
    de: "W-Fragen",
    en: "questions with a question word (who, what, when …)",
    name: "W-Fragen",
    cue: "W-Wort + Verb + Subjekt …?",
    rule: "In a question with a question word (wer, was, wann, wo, wohin, woher, wie, warum, welcher …), the question word comes first, then the conjugated verb, then the subject: Wann fängt der Kurs an? A second verb part goes to the end, just as in a statement. Use wo for a place, wohin for a destination and woher for an origin: Wohin fährt dieser Bus?",
    pattern: "W-Wort + Verb (Pos. 2) + Subjekt + … (+ Verbteil 2)?",
    example: { de: "Wann kommt der Techniker, vormittags oder nachmittags?", en: "When is the technician coming – in the morning or the afternoon?" },
    examples: [
      { de: "Wann kommt der Techniker, vormittags oder nachmittags?", en: "When is the technician coming – in the morning or the afternoon?" },
      { de: "Wo kann ich hier mein Fahrrad abstellen?", en: "Where can I leave my bike here?" },
      { de: "Warum hast du mir nicht Bescheid gesagt?", en: "Why didn't you let me know?" },
    ],
    translate: [
      { en: "How much is the monthly ticket?", de: "Wie viel kostet die Monatskarte?" },
      { en: "Where are you going on holiday this year?", de: "Wohin fährst du dieses Jahr in den Urlaub?" },
      { en: "Which bus goes to the hospital?", de: "Welcher Bus fährt zum Krankenhaus?" },
    ],
    transform: [
      {
        prompt: "Frag nach „um zehn“.",
        input: "Die Besprechung fängt um zehn an.",
        answer: "Wann fängt die Besprechung an?",
      },
      {
        prompt: "Frag nach „im Briefkasten“.",
        input: "Der Schlüssel liegt im Briefkasten.",
        answer: "Wo liegt der Schlüssel?",
      },
    ],
    tip: "Verb right after the question word, then the subject: „Wo arbeitest du?“, not „Wo du arbeitest?“. For a destination use wohin: „Wohin fährst du?“",
    errors: ["word_order", "word_choice"],
    keys: ["wer", "wen", "wem", "was", "wann", "wo", "woher", "wohin", "wie", "warum", "wieso", "welche"],
  },
  {
    id: "g.ja-nein-fragen",
    kind: "gram",
    hall: "satzbau",
    level: "A1",
    de: "Ja/Nein-Fragen",
    en: "yes/no questions (verb first)",
    name: "Ja/Nein-Fragen",
    cue: "Ja/Nein-Frage: Verb + Subjekt …?",
    rule: "A yes/no question starts with the conjugated verb, followed by the subject (Hast du heute Zeit?), and there is no extra verb like English do: Do you smoke? is just Rauchst du? A second verb part – infinitive, participle or separable prefix – still goes to the end: Kannst du mich abholen?",
    pattern: "Verb + Subjekt + … (+ Verbteil 2)?",
    example: { de: "Hast du heute Abend Zeit? Ich muss einen Schrank aufbauen.", en: "Are you free this evening? I have to put a wardrobe together." },
    examples: [
      { de: "Hast du heute Abend Zeit? Ich muss einen Schrank aufbauen.", en: "Are you free this evening? I have to put a wardrobe together." },
      { de: "Kann ich auch mit Karte zahlen oder nur bar?", en: "Can I pay by card too, or is it cash only?" },
      { de: "Haben Sie die Rechnung schon bekommen?", en: "Have you received the invoice yet?" },
    ],
    translate: [
      { en: "Are you coming to the barbecue on Saturday?", de: "Kommst du am Samstag zum Grillen?" },
      { en: "Is this seat free?", de: "Ist der Platz noch frei?" },
      { en: "Did you lock the door?", de: "Hast du die Tür abgeschlossen?" },
    ],
    transform: [
      {
        prompt: "Mach eine Ja/Nein-Frage.",
        input: "Der Zug nach Köln hat Verspätung.",
        answer: "Hat der Zug nach Köln Verspätung?",
      },
      {
        prompt: "Mach eine Ja/Nein-Frage mit „Sie“.",
        input: "Ich kann den Termin verschieben.",
        answer: "Können Sie den Termin verschieben?",
      },
    ],
    tip: "There's no do in German questions: „Rauchst du?“, not „Machst du rauchen?“. Start with the verb and put the subject right after it: „Hast du Zeit?“",
    errors: ["word_order", "extra_word"],
    keys: [],
  },
  {
    id: "g.personalpronomen-nominativ",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "Personalpronomen im Nominativ",
    en: "Subject pronouns (I, you, he, she …)",
    name: "Pronomen: ich, du, Sie",
    cue: "Pronomen: er/sie/es, du/ihr/Sie",
    rule: "The subject pronouns are ich, du, er/sie/es, wir, ihr, sie (they) and Sie (formal you, always with a capital S). Use du for a friend or family member, ihr for several of them, and Sie for adults you don't know well, for example at offices or with your landlord – Sie takes the same verb form as sie (they). For things, choose er, sie or es by the gender of the noun: Der Drucker? Er ist kaputt.",
    pattern: "ich · du · er/sie/es · wir · ihr · sie/Sie + passende Verbform · der → er, die → sie, das → es",
    example: { de: "Wo ist die Fernbedienung? – Sie liegt auf dem Sofa.", en: "Where's the remote? – It's on the sofa." },
    examples: [
      { de: "Wo ist die Fernbedienung? – Sie liegt auf dem Sofa.", en: "Where's the remote? – It's on the sofa." },
      {
        de: "Kommt ihr heute Abend mit? Wir gehen in die neue Pizzeria am Markt.",
        en: "Are you coming along tonight? We're going to the new pizzeria by the market.",
      },
      { de: "Frau Wagner, haben Sie morgen um neun Zeit?", en: "Ms Wagner, are you free tomorrow at nine?" },
    ],
    translate: [
      { en: "Is the coffee still hot? – No, it's cold.", de: "Ist der Kaffee noch heiß? – Nein, er ist kalt." },
      { en: "(to your boss) Have you got a minute?", de: "Haben Sie kurz Zeit?" },
      { en: "(to two colleagues) Are you coming to the canteen with us?", de: "Kommt ihr mit uns in die Kantine?" },
    ],
    transform: [
      {
        prompt: "Ersetze das zweite Nomen durch ein Pronomen.",
        input: "Der Kühlschrank macht komische Geräusche. Der Kühlschrank ist erst ein Jahr alt.",
        answer: "Der Kühlschrank macht komische Geräusche. Er ist erst ein Jahr alt.",
      },
      {
        prompt: "Frag höflich mit „Sie“.",
        input: "Wohnst du auch hier im Haus?",
        answer: "Wohnen Sie auch hier im Haus?",
      },
    ],
    tip: "English it isn't always es: „Der Laptop? Er ist neu.“ „Die Tür? Sie ist offen.“ Formal Sie has a capital S and the -en verb form: „Kommen Sie?“",
    errors: ["pronoun", "verb_form", "capitalization"],
    keys: ["ich", "du", "er", "sie", "es", "wir", "ihr"],
  },
  {
    id: "g.plural",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "Plural der Nomen",
    en: "Plural of nouns",
    name: "Pluralendungen",
    cue: "Plural (z. B. Termine, Rechnungen)",
    rule: "Learn every noun with its plural, because there are several patterns: -e (Termin – Termine), -(e)n, typical for feminine nouns (Rechnung – Rechnungen), -er (Kind – Kinder, Haus – Häuser), -s for many foreign words (Handy – Handys) and no ending for many nouns in -er, -el, -en (Koffer – Koffer). Many plurals also add an umlaut: Arzt – Ärzte, Mutter – Mütter. The article is always die, and the dative plural adds -n where it can: mit den Kindern.",
    pattern: "die + Plural: -e · -(e)n · -er · -s · ohne Endung · oft mit Umlaut (Ärzte, Häuser, Mütter) · Dativ: den + …-n",
    example: { de: "Die Brötchen hier sind super, aber die Preise sind ganz schön hoch.", en: "The rolls here are great, but the prices are pretty high." },
    examples: [
      { de: "Die Brötchen hier sind super, aber die Preise sind ganz schön hoch.", en: "The rolls here are great, but the prices are pretty high." },
      {
        de: "Wir haben zwei Kinder und drei Fahrräder – gibt es einen Fahrradkeller?",
        en: "We've got two children and three bikes – is there a bike room in the basement?",
      },
      {
        de: "Die Kolleginnen und Kollegen aus München bringen ihre eigenen Laptops mit.",
        en: "Our colleagues from Munich are bringing their own laptops.",
      },
    ],
    translate: [
      {
        en: "We still need three chairs and two tables for the meeting room.",
        de: "Wir brauchen noch drei Stühle und zwei Tische für den Besprechungsraum.",
      },
      {
        en: "The rooms in this flat are small, but the windows are big.",
        de: "Die Zimmer in dieser Wohnung sind klein, aber die Fenster sind groß.",
      },
      { en: "Next week I've got appointments with two doctors.", de: "Ich habe nächste Woche Termine bei zwei Ärzten." },
    ],
    transform: [
      {
        prompt: "Schreib „die Rechnung“ im Plural.",
        input: "Die Rechnung liegt auf dem Tisch.",
        answer: "Die Rechnungen liegen auf dem Tisch.",
      },
      {
        prompt: "Ergänze den Plural.",
        input: "Für die Party brauchen wir noch zwei ___ (Flasche) Wein und zehn ___ (Glas).",
        answer: "Für die Party brauchen wir noch zwei Flaschen Wein und zehn Gläser.",
      },
    ],
    tip: "Don't add -s to everything as in English: „die Termine“, „die Rechnungen“, „die Kinder“. The -s plural is mainly for foreign words like „die Handys“.",
    errors: ["plural"],
    keys: [],
  },
  {
    id: "g.es-gibt",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "es gibt + Akkusativ",
    en: "There is / there are (es gibt + accusative)",
    name: "es gibt",
    cue: "es gibt / gibt es + Akkusativ",
    rule: "Es gibt means there is or there are, and gibt stays singular even before a plural: Es gibt zwei Supermärkte. What exists is the object, so it is in the accusative: Es gibt einen Park, keinen Aufzug, eine Bäckerei. In questions, and when something else starts the sentence, es goes after gibt: Gibt es hier WLAN? Heute gibt es Fisch.",
    pattern: "Es gibt + Akkusativ (einen/eine/ein, keinen …) · Gibt es + Akkusativ …? · Zeit/Ort + gibt es + Akkusativ",
    example: { de: "Heute gibt es in der Kantine Lasagne oder Gemüsecurry.", en: "Today there's lasagne or vegetable curry in the canteen." },
    examples: [
      { de: "Heute gibt es in der Kantine Lasagne oder Gemüsecurry.", en: "Today there's lasagne or vegetable curry in the canteen." },
      { de: "Gibt es hier in der Nähe einen Geldautomaten?", en: "Is there a cash machine near here?" },
      {
        de: "Es gibt ein Problem mit Ihrer Bestellung: Der Tisch ist erst im Mai lieferbar.",
        en: "There's a problem with your order: the table can't be delivered until May.",
      },
    ],
    translate: [
      { en: "Is there a lift in the building?", de: "Gibt es im Haus einen Aufzug?" },
      { en: "There are no appointments left this week.", de: "Diese Woche gibt es keine Termine mehr." },
      { en: "What's for dinner tonight?", de: "Was gibt es heute zum Abendessen?" },
    ],
    transform: [
      {
        prompt: "Schreib einen Satz mit „es gibt“.",
        input: "Im Hotel: ein Pool, ein Fitnessraum, aber kein Restaurant.",
        answer: "Im Hotel gibt es einen Pool und einen Fitnessraum, aber kein Restaurant.",
      },
      {
        prompt: "Frag mit „Gibt es …?“.",
        input: "Ich suche einen Parkplatz in der Nähe.",
        answer: "Gibt es hier in der Nähe einen Parkplatz?",
      },
    ],
    tip: "After es gibt use the accusative: „Es gibt einen Park“, not „ein Park“. Gibt stays singular before plurals: „Es gibt viele Probleme“, not „Es geben …“.",
    errors: ["case", "verb_form", "word_choice"],
    keys: ["gibt", "gab"],
  },
  {
    id: "g.gern",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "gern, lieber, am liebsten",
    en: "Like doing, prefer, like best (gern, lieber, am liebsten)",
    name: "gern/lieber/am liebsten",
    cue: "Verb + gern / lieber / am liebsten",
    rule: "To say you like doing something, put gern after the verb (Ich koche gern); use lieber for what you prefer (Ich nehme lieber den Zug) and am liebsten for what you like best. Am liebsten often starts the sentence, so the verb comes straight after it: Am liebsten fahre ich mit dem Rad. For people and things you can also use mögen (Ich mag Kaffee), but for activities, verb + gern is the natural choice.",
    pattern: "Subjekt + Verb + (nicht) gern / lieber + … · Am liebsten + Verb + Subjekt + …",
    example: { de: "Ich telefoniere nicht gern, ich schreibe lieber eine E-Mail.", en: "I don't like talking on the phone; I'd rather write an email." },
    examples: [
      { de: "Ich telefoniere nicht gern, ich schreibe lieber eine E-Mail.", en: "I don't like talking on the phone; I'd rather write an email." },
      {
        de: "Was machst du am Wochenende am liebsten? – Am liebsten schlafe ich aus.",
        en: "What do you like doing best at the weekend? – Best of all, I like a lie-in.",
      },
      { de: "Mein Mann kocht gern, ich räume lieber auf.", en: "My husband likes cooking; I'd rather do the tidying up." },
    ],
    translate: [
      { en: "I like cycling to work.", de: "Ich fahre gern mit dem Fahrrad zur Arbeit." },
      { en: "Do you prefer working in the morning or in the evening?", de: "Arbeitest du lieber morgens oder abends?" },
      { en: "Most of all I like going for walks by the river.", de: "Am liebsten gehe ich am Fluss spazieren." },
    ],
    transform: [
      {
        prompt: "Sag es mit „gern“.",
        input: "Kochen macht mir Spaß.",
        answer: "Ich koche gern.",
      },
      {
        prompt: "Sag es mit „lieber“.",
        input: "Tee mag ich mehr als Kaffee.",
        answer: "Ich trinke lieber Tee als Kaffee.",
      },
    ],
    tip: "For activities, verb + gern sounds more natural than mögen: „Ich schwimme gern“. Prefer is lieber: „Ich trinke lieber Tee“, not „Ich mag mehr Tee“.",
    errors: ["word_choice", "word_order"],
    keys: ["gern", "lieber", "liebsten"],
  },
  {
    id: "g.uhrzeit",
    kind: "gram",
    hall: "faelle",
    level: "A1",
    de: "Uhrzeit: um, halb, Viertel vor/nach",
    en: "Telling the time (half past, quarter to …)",
    name: "Uhrzeit: halb, Viertel",
    cue: "um halb neun, um Viertel nach drei …",
    rule: "Use um for the time something happens (um acht Uhr, um halb neun), and ask Wie spät ist es? or Wie viel Uhr ist es? Halb looks ahead to the next hour: halb neun is 8:30, not 9:30. In everyday speech people say Viertel nach acht (8:15), Viertel vor neun (8:45), zehn nach acht (8:10) or kurz vor neun, while timetables and offices use the 24-hour clock: 20:45 Uhr = zwanzig Uhr fünfundvierzig.",
    pattern: "um + Uhrzeit · Viertel nach / vor · zehn nach / vor · halb + nächste Stunde (halb neun = 8:30) · offiziell: 20:45 Uhr",
    example: {
      de: "Mein Zug kommt um Viertel nach sieben an, ich bin also gegen acht im Büro.",
      en: "My train gets in at quarter past seven, so I'll be at the office around eight.",
    },
    examples: [
      {
        de: "Mein Zug kommt um Viertel nach sieben an, ich bin also gegen acht im Büro.",
        en: "My train gets in at quarter past seven, so I'll be at the office around eight.",
      },
      { de: "Die Praxis hat heute nur bis halb eins geöffnet.", en: "The surgery is only open until half past twelve today." },
      { de: "Wie spät ist es? – Kurz vor neun, wir müssen los!", en: "What time is it? – Nearly nine, we have to go!" },
    ],
    translate: [
      { en: "The meeting starts at half past ten.", de: "Die Besprechung fängt um halb elf an." },
      { en: "Can we meet at quarter to seven?", de: "Können wir uns um Viertel vor sieben treffen?" },
      { en: "My flight is at twenty past six in the morning.", de: "Mein Flug geht morgens um zwanzig nach sechs." },
    ],
    transform: [
      {
        prompt: "Schreib die Uhrzeit so, wie man sie im Alltag sagt.",
        input: "Der Film beginnt um 20:30 Uhr.",
        answer: "Der Film beginnt um halb neun.",
      },
      {
        prompt: "Schreib die Uhrzeit so, wie man sie im Alltag sagt.",
        input: "Wir treffen uns um 7:45 Uhr am Bahnhof.",
        answer: "Wir treffen uns um Viertel vor acht am Bahnhof.",
      },
    ],
    tip: "Halb points to the next hour: „halb acht“ is 7:30, not 8:30. For the time of an event use um: „Der Kurs beginnt um sechs“, not „an sechs“.",
    errors: ["preposition", "word_choice"],
    keys: ["uhr", "halb", "viertel", "um", "nach", "vor", "spät"],
  },
  {
    id: "g.man",
    kind: "gram",
    hall: "verben",
    level: "A1",
    de: "man + Verb (er/sie/es-Form)",
    en: "man: you, one, people in general",
    name: "man + Verb",
    cue: "man + er-Form (z. B. man muss)",
    rule: "Man means people in general, like English you, one or they: In Deutschland trennt man den Müll. The verb takes the er/sie/es form (man kann, man muss, man braucht), and if you need the subject again, repeat man – never er: Wenn man krank ist, muss man zum Arzt. Write man with one n; der Mann is a man.",
    pattern: "man + Verb (er/sie/es-Form) + … · man + Modalverb + … + Infinitiv",
    example: {
      de: "Hier darf man leider nicht parken, die Plätze sind nur für Anwohner.",
      en: "Unfortunately you can't park here – the spaces are for residents only.",
    },
    examples: [
      {
        de: "Hier darf man leider nicht parken, die Plätze sind nur für Anwohner.",
        en: "Unfortunately you can't park here – the spaces are for residents only.",
      },
      {
        de: "Wie schreibt man Ihren Nachnamen?",
        en: "How do you spell your surname?",
      },
      {
        de: "Wenn man online bucht, bekommt man zehn Prozent Rabatt.",
        en: "If you book online, you get ten per cent off.",
      },
    ],
    translate: [
      {
        en: "At the Bürgeramt you always need an appointment.",
        de: "Beim Bürgeramt braucht man immer einen Termin.",
      },
      {
        en: "How do you get to the airport from here?",
        de: "Wie kommt man von hier zum Flughafen?",
      },
      {
        en: "You have to book a table at this restaurant.",
        de: "In diesem Restaurant muss man einen Tisch reservieren.",
      },
    ],
    transform: [
      {
        prompt: "Schreib den Satz mit „man“.",
        input: "In der Bibliothek dürfen die Leute nicht telefonieren.",
        answer: "In der Bibliothek darf man nicht telefonieren.",
      },
      {
        prompt: "Schreib den Satz mit „man“.",
        input: "Die Kunden müssen die Tickets vorher online kaufen.",
        answer: "Man muss die Tickets vorher online kaufen.",
      },
    ],
    tip: "Man takes the er-form: „man kann“, „man hat“ – not „man können“. Repeat man instead of switching to er, and spell it with one n.",
    errors: ["verb_form", "pronoun"],
    keys: ["man"],
  },
];

export const GRAMMAR_B1_EXTRA: GramItem[] = [
  {
    id: "g.falls-sobald",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "falls, sobald, solange + Nebensatz",
    en: "if / in case, as soon as, as long as (verb to the end)",
    name: "falls, sobald, solange",
    cue: "falls/sobald/solange … (Verb ans Ende)",
    rule: "Falls means if or in case and makes the condition sound a little less likely than wenn: Falls es regnet, … Sobald means as soon as (Ich rufe an, sobald ich da bin), and solange means as long as, for a period of time or a condition (Solange die Miete pünktlich kommt, …). All three start a subordinate clause, so a comma separates it from the main clause and the verb goes to the end.",
    pattern: "Hauptsatz, falls / sobald / solange + Subjekt + … + Verb. · Falls / Sobald / Solange + … + Verb, Verb + Subjekt + …",
    example: {
      de: "Ich schicke dir die Unterlagen, sobald ich sie vom Steuerberater bekommen habe.",
      en: "I'll send you the documents as soon as I've got them from the tax adviser.",
    },
    examples: [
      {
        de: "Ich schicke dir die Unterlagen, sobald ich sie vom Steuerberater bekommen habe.",
        en: "I'll send you the documents as soon as I've got them from the tax adviser.",
      },
      { de: "Falls der Paketbote kommt, kannst du das Paket bitte annehmen?", en: "If the delivery driver comes, could you take the parcel, please?" },
      {
        de: "Solange die Heizung im Büro nicht repariert ist, arbeiten wir von zu Hause.",
        en: "As long as the heating in the office isn't fixed, we're working from home.",
      },
    ],
    translate: [
      { en: "Call me as soon as you've landed.", de: "Ruf mich an, sobald du gelandet bist." },
      { en: "In case you're running late, I'll wait in the café opposite.", de: "Falls du dich verspätest, warte ich im Café gegenüber." },
      { en: "As long as the children are small, I'm only working part-time.", de: "Solange die Kinder klein sind, arbeite ich nur Teilzeit." },
    ],
    transform: [
      {
        prompt: "Verbinde die Sätze mit „sobald“.",
        input: "Ich bin mit der Arbeit fertig. Dann komme ich zu dir.",
        answer: "Sobald ich mit der Arbeit fertig bin, komme ich zu dir.",
      },
      {
        prompt: "Verbinde die Sätze mit „falls“.",
        input: "Vielleicht fällt der Zug aus. Dann nehmen wir ein Taxi.",
        answer: "Falls der Zug ausfällt, nehmen wir ein Taxi.",
      },
    ],
    tip: "The verb goes to the end of the clause, then comes the main verb: „Sobald ich zu Hause bin, rufe ich dich an“ – not „Sobald ich bin zu Hause, ich rufe …“.",
    errors: ["connector", "word_order", "punctuation"],
    keys: ["falls", "sobald", "solange"],
  },
  {
    id: "g.partizip-adj",
    kind: "gram",
    hall: "faelle",
    level: "B1",
    de: "Partizip I und II als Adjektiv",
    en: "Participles as adjectives (the repaired car, the waiting customer)",
    name: "Partizip als Adjektiv",
    cue: "das reparierte Auto, der wartende Kunde",
    rule: "Participles can describe a noun like adjectives and take the normal adjective endings. Partizip II (bezahlt, repariert) is passive or finished: die bezahlte Rechnung = the bill that has been paid. Partizip I is the infinitive + d and describes something going on at that moment: der wartende Kunde = the customer who is waiting, die steigenden Preise.",
    pattern: "Artikel + Partizip II + Endung + Nomen (das reparierte Auto) · Artikel + Infinitiv-d + Endung + Nomen (der wartende Kunde)",
    example: { de: "Kannst du heute das reparierte Fahrrad in der Werkstatt abholen?", en: "Can you pick up the repaired bike from the workshop today?" },
    examples: [
      { de: "Kannst du heute das reparierte Fahrrad in der Werkstatt abholen?", en: "Can you pick up the repaired bike from the workshop today?" },
      { de: "Wegen der steigenden Mieten wohnen viele junge Leute in einer WG.", en: "Because of rising rents, lots of young people live in flat shares." },
      { de: "Bitte schicken Sie das ausgefüllte Formular bis Freitag zurück.", en: "Please send back the completed form by Friday." },
    ],
    translate: [
      { en: "We're looking for a furnished flat for six months.", de: "Wir suchen eine möblierte Wohnung für sechs Monate." },
      { en: "I can't open the attached file.", de: "Ich kann die angehängte Datei nicht öffnen." },
      { en: "The barking dog next door wakes me up every morning.", de: "Der bellende Hund von nebenan weckt mich jeden Morgen." },
    ],
    transform: [
      {
        prompt: "Mach aus dem Relativsatz ein Partizip.",
        input: "Das Auto, das repariert worden ist, steht vor der Werkstatt.",
        answer: "Das reparierte Auto steht vor der Werkstatt.",
      },
      {
        prompt: "Mach aus dem Relativsatz ein Partizip.",
        input: "Die Kunden, die warten, werden gleich bedient.",
        answer: "Die wartenden Kunden werden gleich bedient.",
      },
    ],
    tip: "Add the adjective ending: „die bezahlte Rechnung“, „mit dem reparierten Auto“. Partizip I keeps its d: „die wartenden Kunden“, not „die warten Kunden“.",
    errors: ["adj_ending", "verb_form"],
    keys: [],
  },
  {
    id: "g.nominalisierung",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "Nominalisierung: das Lernen, beim Kochen, zum Lesen",
    en: "verbs as nouns (learning, while cooking, for reading)",
    name: "das Lernen, beim Kochen",
    cue: "Verb als Nomen (beim …, zum …)",
    rule: "Any infinitive can be used as a neuter noun with a capital letter: das Lernen, das Parken. Beim + verb means while doing it (Beim Kochen höre ich Radio), and zum + verb means for doing it (Mir fehlt die Zeit zum Lesen). An object can join the noun as one word: beim Autofahren, zum Zähneputzen.",
    pattern: "das + Verb (groß) · beim + Verb = während … · zum + Verb = für … · Objekt + Verb als ein Wort (beim Autofahren)",
    example: { de: "Beim Autofahren telefoniere ich grundsätzlich nicht.", en: "I never make phone calls while I'm driving." },
    examples: [
      { de: "Beim Autofahren telefoniere ich grundsätzlich nicht.", en: "I never make phone calls while I'm driving." },
      { de: "Abends fehlt mir oft die Energie zum Kochen.", en: "In the evenings I often don't have the energy to cook." },
      { de: "Das Parken im Hof ist nur für Mieter erlaubt.", en: "Parking in the courtyard is only allowed for tenants." },
    ],
    translate: [
      { en: "I always listen to podcasts while jogging.", de: "Beim Joggen höre ich immer Podcasts." },
      { en: "During the week I don't have time for reading.", de: "Unter der Woche habe ich keine Zeit zum Lesen." },
      { en: "(at the end of a presentation) Thank you for listening.", de: "Vielen Dank fürs Zuhören." },
    ],
    transform: [
      {
        prompt: "Schreib den Satz mit „beim“.",
        input: "Während ich koche, höre ich gern Musik.",
        answer: "Beim Kochen höre ich gern Musik.",
      },
      {
        prompt: "Schreib den Satz mit „zum“.",
        input: "Wir haben im Garten einen Platz, wo wir grillen können.",
        answer: "Wir haben im Garten einen Platz zum Grillen.",
      },
    ],
    tip: "Capitalise the verb and use the short forms: „beim Kochen“, „zum Lesen“ – not „bei kochen“ or „zum lesen“. Beim + verb is a handy way to say while doing.",
    errors: ["capitalization", "preposition", "word_choice"],
    keys: [],
  },
  {
    id: "g.indirekte-rede",
    kind: "gram",
    hall: "verben",
    level: "B1",
    de: "Indirekte Rede (Konjunktiv I)",
    en: "Reported speech (Konjunktiv I)",
    name: "Indirekte Rede",
    cue: "Er sagt, er sei / habe … (Konjunktiv I)",
    rule: "Written and formal German reports speech with Konjunktiv I: the er-form ends in -e (er habe, könne, müsse, komme), sein becomes sei, and the past is habe/sei + participle (sie habe angerufen). Where Konjunktiv I looks like the present – mostly with ich, wir and sie (they) – use Konjunktiv II: Sie sagen, sie hätten keine Zeit. In everyday speech people often just use the indicative with dass: Er sagt, dass er krank ist.",
    pattern: "Er sagt, er sei / habe / könne … · Er sagt, dass er … sei. · gleich wie Präsens → Konjunktiv II: sie hätten, sie würden …",
    example: {
      de: "Herr Weber hat angerufen. Er sagt, er sei krank und komme heute nicht ins Büro.",
      en: "Mr Weber called. He says he's ill and won't be coming into the office today.",
    },
    examples: [
      {
        de: "Herr Weber hat angerufen. Er sagt, er sei krank und komme heute nicht ins Büro.",
        en: "Mr Weber called. He says he's ill and won't be coming into the office today.",
      },
      {
        de: "Die Vermieterin schreibt, die Heizung werde nächste Woche repariert.",
        en: "The landlady writes that the heating will be repaired next week.",
      },
      {
        de: "Meine Kollegen meinen, sie hätten von dem Termin nichts gewusst.",
        en: "My colleagues say they didn't know anything about the appointment.",
      },
    ],
    translate: [
      {
        en: "(in an email to your team) Ms Roth says she's ill and can't come to the meeting.",
        de: "Frau Roth sagt, sie sei krank und könne nicht zur Besprechung kommen.",
      },
      {
        en: "(in a written complaint) The technician said he had already repaired the fridge.",
        de: "Der Techniker hat gesagt, er habe den Kühlschrank schon repariert.",
      },
      {
        en: "(in a report to your boss) The customers say they never received an invoice.",
        de: "Die Kunden sagen, sie hätten nie eine Rechnung bekommen.",
      },
    ],
    transform: [
      {
        prompt: "Gib die Aussage in indirekter Rede wieder (Konjunktiv I).",
        input: "Der Hausmeister sagt: „Ich komme morgen um acht.“",
        answer: "Der Hausmeister sagt, er komme morgen um acht.",
      },
      {
        prompt: "Gib die Aussage in indirekter Rede wieder.",
        input: "Unsere Nachbarn sagen: „Wir haben den Wasserschaden schon gemeldet.“",
        answer: "Unsere Nachbarn sagen, sie hätten den Wasserschaden schon gemeldet.",
      },
    ],
    tip: "Change the pronoun: „Ich bin krank“ → „Er sagt, er sei krank“, not „ich sei“. If Konjunktiv I looks like the present, use Konjunktiv II: „sie hätten“.",
    errors: ["verb_form", "pronoun", "tense"],
    keys: [
      "sei",
      "seien",
      "habe",
      "hätte",
      "hätten",
      "könne",
      "müsse",
      "solle",
      "wolle",
      "dürfe",
      "werde",
      "würde",
      "würden",
      "wisse",
      "komme",
      "gebe",
    ],
  },
  {
    id: "g.relativ-praep",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "Relativsatz mit Präposition, dessen/deren und wo",
    en: "relative clauses with a preposition, whose and where",
    name: "Relativsatz: mit dem …",
    cue: "…, mit dem / in der / dessen / wo …",
    rule: "If the relative clause needs a preposition, it comes first and decides the case of the relative pronoun: die Kollegin, mit der ich arbeite; der Kurs, für den ich mich angemeldet habe; die Leute, bei denen wir wohnen. Whose is dessen after der/das nouns and deren after die nouns and plurals: der Nachbar, dessen Auto … For places you can also use wo: die Stadt, wo ich wohne (= in der ich wohne).",
    pattern: "Nomen, + Präposition + der/den/dem/denen + … + Verb · Nomen, dessen/deren + Nomen + … + Verb · Ort, wo + … + Verb",
    example: { de: "Das ist die Kollegin, mit der ich mir das Büro teile.", en: "That's the colleague I share the office with." },
    examples: [
      { de: "Das ist die Kollegin, mit der ich mir das Büro teile.", en: "That's the colleague I share the office with." },
      {
        de: "Ich habe eine Nachbarin, deren Sohn mir manchmal die Getränkekisten hochträgt.",
        en: "I have a neighbour whose son sometimes carries my crates of drinks upstairs for me.",
      },
      {
        de: "Das Café, wo wir uns das erste Mal getroffen haben, hat leider zugemacht.",
        en: "The café where we first met has closed down, unfortunately.",
      },
    ],
    translate: [
      {
        en: "The flat we're interested in is on the fourth floor.",
        de: "Die Wohnung, für die wir uns interessieren, ist im vierten Stock.",
      },
      { en: "Is that the man whose car is blocking the entrance?", de: "Ist das der Mann, dessen Auto die Einfahrt blockiert?" },
      { en: "These are the people I'm staying with in Hamburg.", de: "Das sind die Leute, bei denen ich in Hamburg wohne." },
    ],
    transform: [
      {
        prompt: "Verbinde die Sätze mit einem Relativsatz.",
        input: "Morgen kommt der Techniker. Ich habe gestern mit ihm telefoniert.",
        answer: "Morgen kommt der Techniker, mit dem ich gestern telefoniert habe.",
      },
      {
        prompt: "Verbinde die Sätze mit „dessen“ oder „deren“.",
        input: "Das ist meine Kollegin. Ihr Mann arbeitet auch bei uns.",
        answer: "Das ist meine Kollegin, deren Mann auch bei uns arbeitet.",
      },
    ],
    tip: "The preposition comes first, not at the end: „die Kollegin, mit der ich arbeite“ – not „die ich mit arbeite“. Dative plural is denen.",
    errors: ["pronoun", "preposition", "case", "word_order"],
    keys: [],
  },
  {
    id: "g.sodass",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "sodass / so …, dass",
    en: "so that / so … that (result, verb to the end)",
    name: "sodass / so … dass",
    cue: "sodass / so + Adjektiv, dass …",
    rule: "Sodass (also written so dass) introduces a result: Der Zug hatte Verspätung, sodass ich den Anschluss verpasst habe. To stress how strong something was, put so + adjective in the main clause and start the result with dass: Ich war so müde, dass ich sofort eingeschlafen bin. Both are subordinate clauses with the verb at the end; for a purpose (in order that), use damit instead.",
    pattern: "Hauptsatz, sodass + Subjekt + … + Verb. · Subjekt + Verb + so + Adjektiv, dass + Subjekt + … + Verb.",
    example: { de: "Es hat die ganze Nacht geschneit, sodass heute viele Züge ausfallen.", en: "It snowed all night, so lots of trains are cancelled today." },
    examples: [
      { de: "Es hat die ganze Nacht geschneit, sodass heute viele Züge ausfallen.", en: "It snowed all night, so lots of trains are cancelled today." },
      { de: "Die Musik bei den Nachbarn war so laut, dass ich nicht schlafen konnte.", en: "The music next door was so loud that I couldn't sleep." },
      { de: "Mein Chef spricht so schnell, dass ich manchmal nur die Hälfte verstehe.", en: "My boss talks so fast that sometimes I only understand half of it." },
    ],
    translate: [
      {
        en: "The printer was broken, so I had to print the documents at home.",
        de: "Der Drucker war kaputt, sodass ich die Unterlagen zu Hause ausdrucken musste.",
      },
      { en: "The flat was so expensive that we didn't take it.", de: "Die Wohnung war so teuer, dass wir sie nicht genommen haben." },
      {
        en: "I was so nervous at the interview that I could hardly speak.",
        de: "Beim Vorstellungsgespräch war ich so nervös, dass ich kaum sprechen konnte.",
      },
    ],
    transform: [
      {
        prompt: "Verbinde die Sätze mit „sodass“.",
        input: "Die Autobahn war gesperrt. Wir sind zwei Stunden zu spät angekommen.",
        answer: "Die Autobahn war gesperrt, sodass wir zwei Stunden zu spät angekommen sind.",
      },
      {
        prompt: "Verbinde die Sätze mit „so …, dass“.",
        input: "Der Kaffee war sehr heiß. Ich konnte ihn nicht trinken.",
        answer: "Der Kaffee war so heiß, dass ich ihn nicht trinken konnte.",
      },
    ],
    tip: "So that as a result is sodass, so that as a purpose is damit. With so + adjective, use dass after the comma: „so müde, dass …“ – not „so müde, sodass …“.",
    errors: ["connector", "word_order", "punctuation"],
    keys: ["sodass", "so dass", "dass"],
  },
  {
    id: "g.indem",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "indem / dadurch, dass",
    en: "by doing something (verb to the end)",
    name: "indem / dadurch, dass",
    cue: "indem / dadurch, dass … (Verb ans Ende)",
    rule: "Indem says how you do or achieve something – English by doing: Ich spare Geld, indem ich mit dem Rad zur Arbeit fahre. Dadurch, dass means the same and can also give a cause; dadurch can stand in the main clause, with dass after the comma: Ich habe dadurch Zeit gespart, dass ich online bestellt habe. Both start a subordinate clause, so the verb goes to the end.",
    pattern: "Hauptsatz, indem + Subjekt + … + Verb. · Dadurch, dass + Subjekt + … + Verb, Verb + Subjekt + … · Subjekt + Verb + dadurch + …, dass + … + Verb.",
    example: {
      de: "Ich spare jeden Monat Geld, indem ich mir mein Mittagessen von zu Hause mitnehme.",
      en: "I save money every month by taking my lunch from home.",
    },
    examples: [
      {
        de: "Ich spare jeden Monat Geld, indem ich mir mein Mittagessen von zu Hause mitnehme.",
        en: "I save money every month by taking my lunch from home.",
      },
      {
        de: "Sie können den Termin online ändern, indem Sie auf den Link in der E-Mail klicken.",
        en: "You can change the appointment online by clicking the link in the email.",
      },
      {
        de: "Dadurch, dass ich jetzt im Homeoffice arbeite, spare ich jeden Tag zwei Stunden Fahrzeit.",
        en: "Because I work from home now, I save two hours of travelling every day.",
      },
    ],
    translate: [
      { en: "You can save on heating costs by airing the rooms properly.", de: "Man kann Heizkosten sparen, indem man richtig lüftet." },
      {
        en: "I found my flat by asking all my colleagues.",
        de: "Ich habe meine Wohnung gefunden, indem ich alle meine Kollegen gefragt habe.",
      },
      {
        en: "By working overtime, he was able to take Friday off.",
        de: "Dadurch, dass er Überstunden gemacht hat, konnte er sich den Freitag freinehmen.",
      },
    ],
    transform: [
      {
        prompt: "Verbinde die Sätze mit „indem“.",
        input: "Wir sparen Strom. Wir schalten die Geräte abends ganz aus.",
        answer: "Wir sparen Strom, indem wir die Geräte abends ganz ausschalten.",
      },
      {
        prompt: "Schreib den Satz mit „dadurch, dass“.",
        input: "Ich habe die Stelle bekommen, weil ich gut Spanisch spreche.",
        answer: "Dadurch, dass ich gut Spanisch spreche, habe ich die Stelle bekommen.",
      },
    ],
    tip: "Don't translate by with bei or mit: „Ich spare Geld, indem ich Rad fahre“, not „bei Rad fahren“. After indem the verb goes to the end.",
    errors: ["connector", "word_order", "punctuation"],
    keys: ["indem", "dadurch"],
  },
  {
    id: "g.als-ob",
    kind: "gram",
    hall: "satzbau",
    level: "B1",
    de: "als ob + Konjunktiv II",
    en: "as if / as though (+ Konjunktiv II)",
    name: "als ob",
    cue: "als ob … + Konjunktiv II (wäre, hätte)",
    rule: "Als ob (as if, as though) compares with something that isn't true or isn't certain, so it usually takes Konjunktiv II: Er tut so, als ob er nichts wüsste. It often follows so tun, aussehen, sich anhören and sich fühlen; the verb goes to the end, and for the past use hätte/wäre + participle. You can also leave out ob – then the verb comes straight after als: Es sieht aus, als würde es gleich regnen.",
    pattern: "Hauptsatz, als ob + Subjekt + … + Konjunktiv II (wäre/hätte/würde …). · Hauptsatz, als + Konjunktiv II + Subjekt + …",
    example: {
      de: "Mein Kollege tut immer so, als ob er wahnsinnig viel zu tun hätte.",
      en: "My colleague always acts as if he had a huge amount to do.",
    },
    examples: [
      {
        de: "Mein Kollege tut immer so, als ob er wahnsinnig viel zu tun hätte.",
        en: "My colleague always acts as if he had a huge amount to do.",
      },
      {
        de: "Du siehst aus, als ob du die ganze Nacht nicht geschlafen hättest.",
        en: "You look as if you hadn't slept all night.",
      },
      {
        de: "Das klingt, als wäre etwas mit dem Motor nicht in Ordnung.",
        en: "That sounds as if something's wrong with the engine.",
      },
    ],
    translate: [
      {
        en: "My flatmate acts as if the kitchen belonged only to him.",
        de: "Mein Mitbewohner tut so, als ob die Küche nur ihm gehören würde.",
      },
      {
        en: "It looks as if it's going to rain any minute.",
        de: "Es sieht so aus, als ob es gleich regnen würde.",
      },
      {
        en: "I feel as if I had the flu.",
        de: "Ich fühle mich, als ob ich eine Grippe hätte.",
      },
    ],
    transform: [
      {
        prompt: "Verbinde die Sätze mit „als ob“.",
        input: "Er tut so. Er hat meine Nachricht nicht gelesen. (Aber er hat sie gelesen.)",
        answer: "Er tut so, als ob er meine Nachricht nicht gelesen hätte.",
      },
      {
        prompt: "Schreib den Satz ohne „ob“.",
        input: "Sie redet, als ob sie alles besser wüsste.",
        answer: "Sie redet, als wüsste sie alles besser.",
      },
    ],
    tip: "After als ob the verb goes to the end: „als ob er krank wäre“. With als alone it comes right after als: „als wäre er krank“ – not „als er krank wäre“.",
    errors: ["connector", "verb_form", "word_order"],
    keys: ["als ob", "als wenn", "als"],
  },
  {
    id: "g.passiv-modal",
    kind: "gram",
    hall: "verben",
    level: "B1",
    de: "Passiv mit Modalverben",
    en: "Passive with modal verbs (must be done, can be done)",
    name: "Passiv mit Modalverb",
    cue: "Passiv mit Modalverb (muss … werden)",
    rule: "To say what must, can or may be done, put the modal verb in position 2 and the participle + werden at the end: Die Rechnung muss bis Freitag bezahlt werden. For the past, use the past of the modal: Das Auto konnte nicht repariert werden. In a subordinate clause the modal goes last: …, weil die Heizung repariert werden muss.",
    pattern: "Subjekt + Modalverb (Pos. 2) + … + Partizip II + werden. · Nebensatz: … + Partizip II + werden + Modalverb.",
    example: {
      de: "Das Formular kann auch online ausgefüllt werden.",
      en: "The form can also be filled in online.",
    },
    examples: [
      {
        de: "Das Formular kann auch online ausgefüllt werden.",
        en: "The form can also be filled in online.",
      },
      {
        de: "Die Tabletten dürfen nicht über 25 Grad gelagert werden.",
        en: "The tablets must not be stored above 25 degrees.",
      },
      {
        de: "Der Termin konnte leider nicht verschoben werden.",
        en: "Unfortunately, the appointment couldn't be moved.",
      },
    ],
    translate: [
      {
        en: "The heating has to be serviced once a year.",
        de: "Die Heizung muss einmal im Jahr gewartet werden.",
      },
      {
        en: "Can the parcel be left with a neighbour?",
        de: "Kann das Paket bei einem Nachbarn abgegeben werden?",
      },
      {
        en: "I'm calling because the tap needs to be replaced.",
        de: "Ich rufe an, weil der Wasserhahn ausgetauscht werden muss.",
      },
    ],
    transform: [
      {
        prompt: "Schreib den Satz im Passiv.",
        input: "Man muss die Kaution vor dem Einzug überweisen.",
        answer: "Die Kaution muss vor dem Einzug überwiesen werden.",
      },
      {
        prompt: "Schreib den Satz im Passiv.",
        input: "Man kann die Tickets nur online kaufen.",
        answer: "Die Tickets können nur online gekauft werden.",
      },
    ],
    tip: "End with participle + werden: „muss repariert werden“, not „repariert worden“ or „werden repariert“. Plural subject, plural modal: „Die Tickets können …“.",
    errors: ["verb_form", "word_order", "aux"],
    keys: ["werden"],
  },
  {
    id: "g.brauchen-zu",
    kind: "gram",
    hall: "verben",
    level: "B1",
    de: "nicht/nur brauchen + zu",
    en: "Don't need to / only need to (brauchen + zu)",
    name: "nicht/nur brauchen zu",
    cue: "nicht/nur brauchen … zu + Infinitiv",
    rule: "Nicht brauchen + zu + infinitive means don't need to, just like nicht müssen: Du brauchst nicht zu kommen. Nur brauchen + zu means you only have to: Sie brauchen nur Ihren Namen einzutragen. Use it only with a negative (nicht, kein, nichts) or with nur or erst; for a plain must, say müssen: Ich muss arbeiten, not Ich brauche zu arbeiten.",
    pattern: "Subjekt + brauchen (Pos. 2) + nicht / kein / nur / erst + … + zu + Infinitiv · trennbar: ab-zu-holen",
    example: {
      de: "Du brauchst mich nicht abzuholen, ich nehme ein Taxi.",
      en: "You don't need to pick me up, I'll take a taxi.",
    },
    examples: [
      {
        de: "Du brauchst mich nicht abzuholen, ich nehme ein Taxi.",
        en: "You don't need to pick me up, I'll take a taxi.",
      },
      {
        de: "Sie brauchen nur hier zu unterschreiben, den Rest mache ich.",
        en: "You only need to sign here – I'll do the rest.",
      },
      {
        de: "Keine Sorge, Sie brauchen heute noch nichts zu bezahlen.",
        en: "Don't worry, you don't need to pay anything today.",
      },
    ],
    translate: [
      {
        en: "You don't need to bring anything, we've got enough food.",
        de: "Du brauchst nichts mitzubringen, wir haben genug zu essen.",
      },
      {
        en: "You only need to press the green button.",
        de: "Sie brauchen nur auf den grünen Knopf zu drücken.",
      },
      {
        en: "We don't need to leave until eight.",
        de: "Wir brauchen erst um acht loszufahren.",
      },
    ],
    transform: [
      {
        prompt: "Schreib den Satz mit „nicht brauchen zu“.",
        input: "Sie müssen den Ausweis nicht mitbringen.",
        answer: "Sie brauchen den Ausweis nicht mitzubringen.",
      },
      {
        prompt: "Schreib den Satz mit „nur brauchen zu“.",
        input: "Du musst nur kurz anrufen, dann komme ich runter.",
        answer: "Du brauchst nur kurz anzurufen, dann komme ich runter.",
      },
    ],
    tip: "Don't forget zu: „Du brauchst nicht zu warten“; with separable verbs it goes inside: „abzuholen“. For a positive must, use müssen, not brauchen.",
    errors: ["missing_word", "word_order", "word_choice"],
    keys: ["brauche", "brauchst", "braucht", "brauchen"],
  },
  {
    id: "g.adj-nomen",
    kind: "gram",
    hall: "faelle",
    level: "B1",
    de: "Adjektive als Nomen: der Bekannte, etwas Neues",
    en: "Adjectives as nouns (an acquaintance, something new)",
    name: "Adjektiv als Nomen",
    cue: "ein Bekannter, etwas Neues …",
    rule: "Many adjectives and participles work as nouns for people: der/die Bekannte, Angestellte, Verwandte, Erwachsene, Deutsche. They are capitalised but keep adjective endings, which change with the article and case: der Bekannte, ein Bekannter, mit einem Bekannten, meine Bekannten. For ideas they are neuter: das Gute, alles Gute; after etwas, nichts, viel and wenig they end in -es: etwas Neues, nichts Besonderes.",
    pattern: "der/die + Adj.-e (der Bekannte) · ein + Adj.-er (ein Bekannter) · das/alles + Adj.-e (das Gute) · etwas/nichts + Adj.-es (etwas Neues)",
    example: { de: "Ein Bekannter von mir sucht auch eine Wohnung in der Gegend.", en: "An acquaintance of mine is also looking for a flat in the area." },
    examples: [
      { de: "Ein Bekannter von mir sucht auch eine Wohnung in der Gegend.", en: "An acquaintance of mine is also looking for a flat in the area." },
      { de: "Die Angestellten im Bürgeramt waren heute erstaunlich freundlich.", en: "The staff at the Bürgeramt were surprisingly friendly today." },
      { de: "Gibt es etwas Neues von der Hausverwaltung?", en: "Is there any news from the property management?" },
    ],
    translate: [
      { en: "My relatives are staying with us over Christmas.", de: "Meine Verwandten sind über Weihnachten bei uns." },
      { en: "There was nothing special on TV.", de: "Im Fernsehen kam nichts Besonderes." },
      {
        en: "The good thing about the new job is the flexible working hours.",
        de: "Das Gute an der neuen Stelle sind die flexiblen Arbeitszeiten.",
      },
    ],
    transform: [
      {
        prompt: "Ergänze die Endungen.",
        input: "Ein Bekannt___ hat mir geholfen. Ich habe dem Bekannt___ eine Flasche Wein geschenkt.",
        answer: "Ein Bekannter hat mir geholfen. Ich habe dem Bekannten eine Flasche Wein geschenkt.",
      },
      {
        prompt: "Ergänze die Endung.",
        input: "Im neuen Job lerne ich jeden Tag etwas Neu___.",
        answer: "Im neuen Job lerne ich jeden Tag etwas Neues.",
      },
    ],
    tip: "Keep the capital letter and the adjective ending: „ein Deutscher“, „die Deutschen“, „mit einem Bekannten“. After etwas and nichts use -es: „etwas Neues“.",
    errors: ["adj_ending", "capitalization"],
    keys: [],
  },
  {
    id: "g.refl-dativ",
    kind: "gram",
    hall: "verben",
    level: "B1",
    de: "Reflexivpronomen im Dativ",
    en: "Reflexive pronoun in the dative (wash your hands, buy yourself …)",
    name: "Reflexiv: mir, dir, sich",
    cue: "mir/dir + Akk. (Ich kaufe mir …)",
    rule: "When a reflexive verb also has an accusative object, the reflexive pronoun is in the dative: Ich wasche mir die Hände, du kaufst dir eine Jacke. Only ich and du look different (mir, dir instead of mich, dich); sich, uns and euch stay the same. German uses this dative for body parts and clothes instead of my/your, and with verbs like sich etwas ansehen, merken, vorstellen, wünschen, leisten and sich Sorgen machen.",
    pattern: "Subjekt + Verb + mir/dir/sich/uns/euch (Dativ) + Akkusativ-Objekt (Ich kaufe mir ein Rad.)",
    example: {
      de: "Ich habe mir endlich eine neue Matratze gekauft.",
      en: "I've finally bought myself a new mattress.",
    },
    examples: [
      {
        de: "Ich habe mir endlich eine neue Matratze gekauft.",
        en: "I've finally bought myself a new mattress.",
      },
      {
        de: "Könnten Sie sich das Angebot bis Freitag ansehen?",
        en: "Could you have a look at the quote by Friday?",
      },
      {
        de: "Ich habe mir beim Fußball den Knöchel verstaucht.",
        en: "I sprained my ankle playing football.",
      },
    ],
    translate: [
      {
        en: "I can't afford a new car at the moment.",
        de: "Ich kann mir im Moment kein neues Auto leisten.",
      },
      {
        en: "Wash your hands, dinner's ready!",
        de: "Wasch dir die Hände, das Essen ist fertig!",
      },
      {
        en: "I'm worried about my mother.",
        de: "Ich mache mir Sorgen um meine Mutter.",
      },
    ],
    transform: [
      {
        prompt: "Frag mit „du“.",
        input: "Ich sehe mir heute Abend das Spiel an.",
        answer: "Siehst du dir heute Abend das Spiel an?",
      },
      {
        prompt: "Ergänze „mich“ oder „mir“.",
        input: "Ich habe ___ erkältet und kaufe ___ jetzt Tee in der Apotheke.",
        answer: "Ich habe mich erkältet und kaufe mir jetzt Tee in der Apotheke.",
      },
    ],
    tip: "With a second object use mir/dir: „Ich kaufe mir einen Mantel“, not „mich“. For body parts, „Ich wasche mir die Hände“ is more natural than „meine Hände“.",
    errors: ["pronoun", "case"],
    keys: ["mir", "dir", "sich", "uns", "euch"],
  },
];
