import type { Scenario } from "./types";

// Everyday situations the learner writes about (1–2 sentences each).
// Six per topic, mixing complaints, questions, apologies, suggestions,
// opinions, favours, reactions to news, past events and plans.

export const SCENARIOS: Scenario[] = [
  // ── Alltag ────────────────────────────────────────────────────────
  {
    id: "s.alltag-1",
    topic: "alltag",
    de: "Heute Morgen hat dein Wecker nicht geklingelt. Du erzählst einer Kollegin, wie dein Morgen war.",
    en: "Your alarm didn't go off this morning. You tell a colleague how your morning went.",
  },
  {
    id: "s.alltag-2",
    topic: "alltag",
    de: "Deine Waschmaschine ist kaputt. Du fragst eine Freundin, ob du bei ihr waschen kannst.",
    en: "Your washing machine is broken. You ask a friend if you can do your washing at her place.",
  },
  {
    id: "s.alltag-3",
    topic: "alltag",
    de: "Du und deine Mitbewohnerin wollt am Samstag die Wohnung putzen. Du schreibst ihr, wer was macht.",
    en: "You and your flatmate want to clean the flat on Saturday. You write to her about who will do what.",
  },
  {
    id: "s.alltag-4",
    topic: "alltag",
    de: "Ein Freund sagt, dass man auch am Wochenende früh aufstehen sollte. Du sagst ihm deine Meinung.",
    en: "A friend says you should get up early at the weekend too. You tell him what you think.",
  },
  {
    id: "s.alltag-5",
    topic: "alltag",
    de: "Du hast vergessen, den Müll rauszubringen, und dein Mitbewohner ist sauer. Du entschuldigst dich bei ihm.",
    en: "You forgot to take the rubbish out, and your flatmate is annoyed. You apologise to him.",
  },
  {
    id: "s.alltag-6",
    topic: "alltag",
    de: "Du hast deinen Hausschlüssel verloren. Du bittest deine Schwester, dir den Ersatzschlüssel zu bringen.",
    en: "You've lost your house key. You ask your sister to bring you the spare key.",
  },

  // ── Wohnen ────────────────────────────────────────────────────────
  {
    id: "s.wohnen-1",
    topic: "wohnen",
    de: "Seit drei Tagen gibt es in deiner Wohnung kein warmes Wasser. Du schreibst der Hausverwaltung.",
    en: "There has been no hot water in your flat for three days. You write to the property management.",
  },
  {
    id: "s.wohnen-2",
    topic: "wohnen",
    de: "Deine Nachbarn feiern jedes Wochenende bis drei Uhr nachts. Du schreibst ihnen eine freundliche Nachricht.",
    en: "Your neighbours have parties every weekend until three in the morning. You write them a friendly note.",
  },
  {
    id: "s.wohnen-3",
    topic: "wohnen",
    de: "Letzten Monat bist du in eine neue Wohnung umgezogen. Du erzählst einem Freund, wie der Umzug war.",
    en: "Last month you moved into a new flat. You tell a friend how the move went.",
  },
  {
    id: "s.wohnen-4",
    topic: "wohnen",
    de: "Du hast eine Anzeige für eine schöne Wohnung gesehen. Du schreibst dem Vermieter und fragst nach einem Besichtigungstermin.",
    en: "You've seen an advert for a nice flat. You write to the landlord and ask for a viewing.",
  },
  {
    id: "s.wohnen-5",
    topic: "wohnen",
    de: "Am Samstag ziehst du um. Du fragst deine Freunde, ob sie dir beim Tragen helfen können.",
    en: "You're moving on Saturday. You ask your friends if they can help you carry things.",
  },
  {
    id: "s.wohnen-6",
    topic: "wohnen",
    de: "Im Treppenhaus stehen immer viele Fahrräder. Du schlägst deinen Nachbarn eine Lösung vor.",
    en: "There are always lots of bikes in the stairwell. You suggest a solution to your neighbours.",
  },

  // ── Arbeit ────────────────────────────────────────────────────────
  {
    id: "s.arbeit-1",
    topic: "arbeit",
    de: "Du bist heute Morgen mit Fieber aufgewacht. Du schreibst deiner Chefin, dass du nicht zur Arbeit kommen kannst.",
    en: "You woke up with a temperature this morning. You write to your boss that you can't come to work.",
  },
  {
    id: "s.arbeit-2",
    topic: "arbeit",
    de: "Gestern hattest du ein Vorstellungsgespräch. Du erzählst einer Freundin, wie das Gespräch war.",
    en: "You had a job interview yesterday. You tell a friend how it went.",
  },
  {
    id: "s.arbeit-3",
    topic: "arbeit",
    de: "In deinem Team gibt es zu viele lange Meetings. Du machst deinem Chef einen Vorschlag.",
    en: "There are too many long meetings in your team. You make a suggestion to your boss.",
  },
  {
    id: "s.arbeit-4",
    topic: "arbeit",
    de: "Du möchtest nächsten Freitag freinehmen. Du fragst einen Kollegen, ob er deine Schicht übernehmen kann.",
    en: "You'd like to take next Friday off. You ask a colleague if he can cover your shift.",
  },
  {
    id: "s.arbeit-5",
    topic: "arbeit",
    de: "Deine Kollegin erzählt dir, dass sie die Firma Ende des Monats verlässt. Du reagierst auf die Nachricht.",
    en: "Your colleague tells you she's leaving the company at the end of the month. You react to the news.",
  },
  {
    id: "s.arbeit-6",
    topic: "arbeit",
    de: "Du hast eine interessante Stellenanzeige gefunden. Du schreibst der Firma, warum du gut zur Stelle passt.",
    en: "You've found an interesting job advert. You write to the company explaining why you're a good fit for the job.",
  },

  // ── Einkaufen ─────────────────────────────────────────────────────
  {
    id: "s.einkaufen-1",
    topic: "einkaufen",
    de: "Du hast online eine Jacke bestellt, aber sie ist zu klein. Du bittest den Shop um einen Umtausch.",
    en: "You ordered a jacket online, but it's too small. You ask the shop for an exchange.",
  },
  {
    id: "s.einkaufen-2",
    topic: "einkaufen",
    de: "Dein neuer Wasserkocher ist nach zwei Tagen kaputtgegangen. Du bringst ihn zurück ins Geschäft.",
    en: "Your new kettle broke after two days. You take it back to the shop.",
  },
  {
    id: "s.einkaufen-3",
    topic: "einkaufen",
    de: "Im Supermarkt suchst du glutenfreies Brot, aber du findest es nicht. Du fragst einen Mitarbeiter.",
    en: "You're looking for gluten-free bread in the supermarket, but you can't find it. You ask a member of staff.",
  },
  {
    id: "s.einkaufen-4",
    topic: "einkaufen",
    de: "Am Wochenende warst du auf einem Flohmarkt. Du erzählst einer Freundin, was du gekauft hast.",
    en: "You went to a flea market at the weekend. You tell a friend what you bought.",
  },
  {
    id: "s.einkaufen-5",
    topic: "einkaufen",
    de: "Eine Freundin kauft fast alles im Internet. Du sagst ihr, was du von Onlineshopping hältst.",
    en: "A friend buys almost everything online. You tell her what you think of online shopping.",
  },
  {
    id: "s.einkaufen-6",
    topic: "einkaufen",
    de: "Am Samstag willst du ein neues Fahrrad kaufen. Du fragst einen Freund, ob er mitkommt und dich berät.",
    en: "On Saturday you want to buy a new bike. You ask a friend if he'll come along and give you advice.",
  },

  // ── Essen & Trinken ───────────────────────────────────────────────
  {
    id: "s.essen-1",
    topic: "essen",
    de: "Du wartest im Restaurant schon seit 40 Minuten auf dein Essen. Du sprichst mit der Kellnerin.",
    en: "You've been waiting 40 minutes for your food in a restaurant. You speak to the waitress.",
  },
  {
    id: "s.essen-2",
    topic: "essen",
    de: "Am Samstag kochst du für Freunde. Du fragst sie, was sie gern essen und was nicht.",
    en: "On Saturday you're cooking for friends. You ask them what they like to eat and what they don't.",
  },
  {
    id: "s.essen-3",
    topic: "essen",
    de: "Gestern hast du zum ersten Mal Käsespätzle gekocht. Du erzählst einer Kollegin, wie es war.",
    en: "Yesterday you made Käsespätzle for the first time. You tell a colleague how it went.",
  },
  {
    id: "s.essen-4",
    topic: "essen",
    de: "Dein Kollege isst jeden Mittag Fast Food. Du sagst ihm deine Meinung dazu.",
    en: "Your colleague eats fast food every lunchtime. You tell him what you think about it.",
  },
  {
    id: "s.essen-5",
    topic: "essen",
    de: "Du möchtest für Freitagabend einen Tisch für sechs Personen reservieren. Du rufst im Restaurant an.",
    en: "You want to book a table for six for Friday evening. You call the restaurant.",
  },
  {
    id: "s.essen-6",
    topic: "essen",
    de: "Ein neuer Kollege kennt die Stadt noch nicht. Du empfiehlst ihm ein Restaurant für die Mittagspause.",
    en: "A new colleague doesn't know the city yet. You recommend a restaurant for the lunch break.",
  },

  // ── Gesundheit ────────────────────────────────────────────────────
  {
    id: "s.gesundheit-1",
    topic: "gesundheit",
    de: "Du hast seit drei Tagen Fieber und Halsschmerzen. Du erklärst der Ärztin, wie es dir geht.",
    en: "You've had a temperature and a sore throat for three days. You explain to the doctor how you feel.",
  },
  {
    id: "s.gesundheit-2",
    topic: "gesundheit",
    de: "Du hast starke Zahnschmerzen und brauchst schnell einen Termin. Du rufst in der Zahnarztpraxis an.",
    en: "You have bad toothache and need an appointment quickly. You call the dental practice.",
  },
  {
    id: "s.gesundheit-3",
    topic: "gesundheit",
    de: "Am Wochenende bist du beim Joggen hingefallen. Du erzählst deinem Arzt, was passiert ist.",
    en: "You fell over while jogging at the weekend. You tell your doctor what happened.",
  },
  {
    id: "s.gesundheit-4",
    topic: "gesundheit",
    de: "Du bist stark erkältet, hast aber keine Zeit für einen Arztbesuch. Du fragst in der Apotheke um Rat.",
    en: "You have a bad cold but no time to see a doctor. You ask for advice at the pharmacy.",
  },
  {
    id: "s.gesundheit-5",
    topic: "gesundheit",
    de: "Du kannst morgen nicht zu deinem Termin beim Hautarzt kommen. Du sagst den Termin per E-Mail ab.",
    en: "You can't make your appointment with the dermatologist tomorrow. You cancel it by email.",
  },
  {
    id: "s.gesundheit-6",
    topic: "gesundheit",
    de: "Eine Freundin schläft seit Wochen schlecht und ist immer müde. Du gibst ihr einen Rat.",
    en: "A friend has been sleeping badly for weeks and is always tired. You give her some advice.",
  },

  // ── Reisen & Verkehr ──────────────────────────────────────────────
  {
    id: "s.reisen-1",
    topic: "reisen",
    de: "Dein Zug hat zwei Stunden Verspätung, und du verpasst deinen Anschluss. Du sprichst mit einer Mitarbeiterin der Bahn.",
    en: "Your train is two hours late and you miss your connection. You speak to a member of the railway staff.",
  },
  {
    id: "s.reisen-2",
    topic: "reisen",
    de: "Du bist gerade aus dem Urlaub zurückgekommen. Du erzählst deinen Kollegen, was du erlebt hast.",
    en: "You've just got back from holiday. You tell your colleagues what you did.",
  },
  {
    id: "s.reisen-3",
    topic: "reisen",
    de: "Im Sommer möchtest du mit Freunden verreisen. Du schlägst ein Reiseziel vor und erklärst, warum.",
    en: "You'd like to go away with friends in the summer. You suggest a destination and explain why.",
  },
  {
    id: "s.reisen-4",
    topic: "reisen",
    de: "Dein Hotelzimmer ist sehr laut, und die Klimaanlage funktioniert nicht. Du beschwerst dich an der Rezeption.",
    en: "Your hotel room is very noisy, and the air conditioning doesn't work. You complain at reception.",
  },
  {
    id: "s.reisen-5",
    topic: "reisen",
    de: "Du willst nächste Woche mit dem Bus zum Flughafen fahren. Du fragst an der Information nach Abfahrtszeiten und Preisen.",
    en: "Next week you want to take the bus to the airport. You ask at the information desk about departure times and prices.",
  },
  {
    id: "s.reisen-6",
    topic: "reisen",
    de: "Nach deinem Flug ist dein Koffer nicht angekommen. Du meldest das am Flughafen.",
    en: "After your flight, your suitcase didn't arrive. You report it at the airport.",
  },

  // ── Freizeit ──────────────────────────────────────────────────────
  {
    id: "s.freizeit-1",
    topic: "freizeit",
    de: "Am Samstag gibt es in deiner Stadt ein Open-Air-Konzert. Du fragst einen Freund, ob er mitkommen will.",
    en: "There's an open-air concert in your town on Saturday. You ask a friend if he wants to come along.",
  },
  {
    id: "s.freizeit-2",
    topic: "freizeit",
    de: "Letztes Wochenende warst du zum ersten Mal klettern. Du erzählst einer Kollegin davon.",
    en: "Last weekend you went climbing for the first time. You tell a colleague about it.",
  },
  {
    id: "s.freizeit-3",
    topic: "freizeit",
    de: "Du möchtest wieder Fußball spielen. Du schreibst einem Verein in deiner Nähe und fragst nach den Trainingszeiten.",
    en: "You'd like to play football again. You write to a club near you and ask about training times.",
  },
  {
    id: "s.freizeit-4",
    topic: "freizeit",
    de: "Ein Freund findet Museen langweilig. Du sagst ihm, was du davon hältst.",
    en: "A friend thinks museums are boring. You tell him what you think.",
  },
  {
    id: "s.freizeit-5",
    topic: "freizeit",
    de: "Freunde haben dich zum Grillen eingeladen, aber du hast keine Zeit. Du sagst ab und schlägst einen anderen Tag vor.",
    en: "Friends have invited you to a barbecue, but you don't have time. You say no and suggest another day.",
  },
  {
    id: "s.freizeit-6",
    topic: "freizeit",
    de: "Nächstes Jahr möchtest du ein neues Hobby anfangen. Du erzählst einem Freund, was du machen willst und warum.",
    en: "Next year you'd like to take up a new hobby. You tell a friend what you want to do and why.",
  },

  // ── Familie & Freunde ─────────────────────────────────────────────
  {
    id: "s.familie-1",
    topic: "familie",
    de: "Deine Schwester erzählt dir, dass sie ein Baby bekommt. Du reagierst auf die Nachricht.",
    en: "Your sister tells you she's having a baby. You react to the news.",
  },
  {
    id: "s.familie-2",
    topic: "familie",
    de: "Du hast den Geburtstag deines besten Freundes vergessen. Du schreibst ihm eine Nachricht.",
    en: "You forgot your best friend's birthday. You send him a message.",
  },
  {
    id: "s.familie-3",
    topic: "familie",
    de: "Deine Eltern feiern bald ihren 40. Hochzeitstag. Du planst mit deinem Bruder eine Überraschung.",
    en: "Your parents will soon celebrate their 40th wedding anniversary. You plan a surprise with your brother.",
  },
  {
    id: "s.familie-4",
    topic: "familie",
    de: "Am Wochenende warst du auf einer Hochzeit. Du erzählst einer Freundin, wie die Feier war.",
    en: "You went to a wedding at the weekend. You tell a friend what the celebration was like.",
  },
  {
    id: "s.familie-5",
    topic: "familie",
    de: "Ein Freund hat Streit mit seiner Freundin und fragt dich um Rat. Du gibst ihm einen Tipp.",
    en: "A friend is arguing with his girlfriend and asks you for advice. You give him a tip.",
  },
  {
    id: "s.familie-6",
    topic: "familie",
    de: "Du musst am Freitag lange arbeiten. Du fragst deine Mutter, ob sie die Kinder vom Kindergarten abholen kann.",
    en: "You have to work late on Friday. You ask your mother if she can pick the children up from nursery.",
  },

  // ── Ämter & Bank ──────────────────────────────────────────────────
  {
    id: "s.behoerden-1",
    topic: "behoerden",
    de: "Du bist neu in der Stadt und musst dich anmelden. Du fragst im Bürgeramt, welche Unterlagen du brauchst.",
    en: "You're new in town and have to register your address. You ask at the citizens' office which documents you need.",
  },
  {
    id: "s.behoerden-2",
    topic: "behoerden",
    de: "Deine Bankkarte ist weg, vielleicht wurde sie gestohlen. Du rufst bei deiner Bank an.",
    en: "Your bank card is missing; maybe it was stolen. You call your bank.",
  },
  {
    id: "s.behoerden-3",
    topic: "behoerden",
    de: "Vor drei Wochen hast du der Krankenkasse einen Brief geschickt, aber noch keine Antwort bekommen. Du schreibst noch einmal.",
    en: "Three weeks ago you sent a letter to your health insurance fund, but you haven't had a reply yet. You write again.",
  },
  {
    id: "s.behoerden-4",
    topic: "behoerden",
    de: "Dein Aufenthaltstitel läuft in zwei Monaten ab. Du schreibst der Ausländerbehörde und bittest um einen Termin.",
    en: "Your residence permit runs out in two months. You write to the immigration office and ask for an appointment.",
  },
  {
    id: "s.behoerden-5",
    topic: "behoerden",
    de: "Dein Paket ist nicht angekommen, aber online steht, dass es zugestellt wurde. Du schreibst dem Paketdienst.",
    en: "Your parcel hasn't arrived, but online it says it was delivered. You write to the delivery company.",
  },
  {
    id: "s.behoerden-6",
    topic: "behoerden",
    de: "Du verstehst einen Brief vom Finanzamt nicht. Du bittest eine Kollegin um Hilfe.",
    en: "You don't understand a letter from the tax office. You ask a colleague for help.",
  },

  // ── Lernen & Kurse ────────────────────────────────────────────────
  {
    id: "s.bildung-1",
    topic: "bildung",
    de: "Du möchtest abends einen B1-Kurs besuchen. Du schreibst der Sprachschule und fragst nach Terminen und Preisen.",
    en: "You'd like to take a B1 course in the evenings. You write to the language school and ask about dates and prices.",
  },
  {
    id: "s.bildung-2",
    topic: "bildung",
    de: "Du warst letzte Woche zweimal nicht im Kurs. Du schreibst deiner Lehrerin und erklärst, warum.",
    en: "You missed class twice last week. You write to your teacher and explain why.",
  },
  {
    id: "s.bildung-3",
    topic: "bildung",
    de: "Im Kurs diskutiert ihr: Kann man eine Sprache nur mit Apps lernen? Du sagst deine Meinung.",
    en: "In class you're discussing whether you can learn a language with apps alone. You give your opinion.",
  },
  {
    id: "s.bildung-4",
    topic: "bildung",
    de: "Gestern hast du deine Deutschprüfung geschrieben. Du erzählst einem Freund, wie es gelaufen ist.",
    en: "Yesterday you took your German exam. You tell a friend how it went.",
  },
  {
    id: "s.bildung-5",
    topic: "bildung",
    de: "Nächstes Jahr möchtest du eine Weiterbildung machen. Du erzählst deiner Chefin von deinen Plänen.",
    en: "Next year you'd like to do some further training. You tell your boss about your plans.",
  },
  {
    id: "s.bildung-6",
    topic: "bildung",
    de: "Jemand aus deinem Deutschkurs hat Probleme mit der Grammatik. Du schlägst vor, zusammen zu lernen.",
    en: "Someone in your German course is struggling with grammar. You suggest studying together.",
  },

  // ── Kommunikation ─────────────────────────────────────────────────
  {
    id: "s.kommunikation-1",
    topic: "kommunikation",
    de: "Dein Internet funktioniert seit zwei Tagen nicht. Du rufst bei deinem Anbieter an.",
    en: "Your internet hasn't been working for two days. You call your provider.",
  },
  {
    id: "s.kommunikation-2",
    topic: "kommunikation",
    de: "Du hast eine wichtige E-Mail von einem Kunden erst nach einer Woche gelesen. Du antwortest und entschuldigst dich.",
    en: "You only read an important email from a customer a week later. You reply and apologise.",
  },
  {
    id: "s.kommunikation-3",
    topic: "kommunikation",
    de: "Ein Freund sagt, dass Kinder unter zwölf kein Smartphone haben sollten. Du sagst ihm deine Meinung.",
    en: "A friend says children under twelve shouldn't have a smartphone. You tell him what you think.",
  },
  {
    id: "s.kommunikation-4",
    topic: "kommunikation",
    de: "Dein Vermieter geht nicht ans Telefon. Du hinterlässt ihm eine Nachricht und erklärst dein Problem.",
    en: "Your landlord isn't answering the phone. You leave him a message and explain your problem.",
  },
  {
    id: "s.kommunikation-5",
    topic: "kommunikation",
    de: "Gestern hast du in den Nachrichten etwas Interessantes gesehen. Du erzählst einer Kollegin davon.",
    en: "Yesterday you saw something interesting on the news. You tell a colleague about it.",
  },
  {
    id: "s.kommunikation-6",
    topic: "kommunikation",
    de: "Dein Handy ist kaputt, und du musst dringend telefonieren. Du fragst einen Nachbarn, ob du sein Telefon benutzen darfst.",
    en: "Your mobile is broken and you urgently need to make a call. You ask a neighbour if you can use his phone.",
  },

  // ── Wetter & Natur ────────────────────────────────────────────────
  {
    id: "s.natur-1",
    topic: "natur",
    de: "Für Sonntag ist ein Gewitter angesagt. Du schreibst deinen Freunden, dass ihr die Wanderung verschieben solltet.",
    en: "A thunderstorm is forecast for Sunday. You write to your friends that you should postpone the hike.",
  },
  {
    id: "s.natur-2",
    topic: "natur",
    de: "In deiner Firma gibt es für den Kaffee nur Plastikbecher. Du machst einen Vorschlag, wie man Müll vermeiden kann.",
    en: "At your company there are only plastic cups for coffee. You make a suggestion on how to avoid waste.",
  },
  {
    id: "s.natur-3",
    topic: "natur",
    de: "Letzte Woche hat es drei Tage lang stark geschneit. Du erzählst einer Freundin, was du erlebt hast.",
    en: "Last week it snowed heavily for three days. You tell a friend what it was like for you.",
  },
  {
    id: "s.natur-4",
    topic: "natur",
    de: "Eine Kollegin sagt, dass der Winter die schönste Jahreszeit ist. Du sagst ihr, was du denkst.",
    en: "A colleague says winter is the most beautiful season. You tell her what you think.",
  },
  {
    id: "s.natur-5",
    topic: "natur",
    de: "Am Wochenende soll es sonnig und warm werden. Du schlägst einem Freund einen Ausflug vor.",
    en: "The weekend is supposed to be sunny and warm. You suggest a day trip to a friend.",
  },
  {
    id: "s.natur-6",
    topic: "natur",
    de: "Ein Nachbar wirft seinen Müll nie in die richtige Tonne. Du sprichst freundlich mit ihm.",
    en: "A neighbour never puts his rubbish in the right bin. You have a friendly word with him.",
  },

  // ── Gefühle & Meinung ─────────────────────────────────────────────
  {
    id: "s.gefuehle-1",
    topic: "gefuehle",
    de: "Dein bester Freund hat endlich eine neue Stelle gefunden. Du schreibst ihm eine Nachricht.",
    en: "Your best friend has finally found a new job. You send him a message.",
  },
  {
    id: "s.gefuehle-2",
    topic: "gefuehle",
    de: "Heute war jemand in der U-Bahn sehr unfreundlich zu dir. Du erzählst deinem Partner, wie du dich gefühlt hast.",
    en: "Today someone on the underground was very rude to you. You tell your partner how you felt.",
  },
  {
    id: "s.gefuehle-3",
    topic: "gefuehle",
    de: "Morgen hast du ein wichtiges Gespräch und bist sehr nervös. Du schreibst einer Freundin, wie es dir geht.",
    en: "You have an important meeting tomorrow and you're very nervous. You write to a friend about how you're feeling.",
  },
  {
    id: "s.gefuehle-4",
    topic: "gefuehle",
    de: "Eine Kollegin erzählt dir, dass ihr Vater im Krankenhaus liegt. Du reagierst darauf.",
    en: "A colleague tells you that her father is in hospital. You respond.",
  },
  {
    id: "s.gefuehle-5",
    topic: "gefuehle",
    de: "Eine Freundin fragt dich, was dir in einer Freundschaft wichtig ist. Du antwortest ihr.",
    en: "A friend asks you what matters to you in a friendship. You answer her.",
  },
  {
    id: "s.gefuehle-6",
    topic: "gefuehle",
    de: "Du warst gestern gestresst und hast deine Schwester angeschrien. Heute entschuldigst du dich bei ihr.",
    en: "Yesterday you were stressed and shouted at your sister. Today you apologise to her.",
  },

  // ── Stadt & Wege ──────────────────────────────────────────────────
  {
    id: "s.stadt-1",
    topic: "stadt",
    de: "Du suchst die nächste Apotheke, aber du kennst dich hier nicht aus. Du fragst eine Frau auf der Straße.",
    en: "You're looking for the nearest pharmacy, but you don't know the area. You ask a woman in the street.",
  },
  {
    id: "s.stadt-2",
    topic: "stadt",
    de: "Ein Tourist fragt dich, wie er zum Bahnhof kommt. Du erklärst ihm den Weg.",
    en: "A tourist asks you how to get to the station. You give him directions.",
  },
  {
    id: "s.stadt-3",
    topic: "stadt",
    de: "Deine Stadt will im Zentrum keine Autos mehr erlauben. Du sagst, was du davon hältst.",
    en: "Your city wants to ban cars from the centre. You say what you think of the idea.",
  },
  {
    id: "s.stadt-4",
    topic: "stadt",
    de: "Am Samstag hast du dich in einem fremden Stadtteil verlaufen. Du erzählst einer Freundin, was passiert ist.",
    en: "On Saturday you got lost in an unfamiliar part of town. You tell a friend what happened.",
  },
  {
    id: "s.stadt-5",
    topic: "stadt",
    de: "Nächste Woche besucht dich eine Freundin zum ersten Mal. Du schlägst vor, was ihr zusammen anschauen könnt.",
    en: "Next week a friend is visiting you for the first time. You suggest what you could see together.",
  },
  {
    id: "s.stadt-6",
    topic: "stadt",
    de: "Vor deinem Haus ist seit Wochen die Straßenlaterne kaputt. Du schreibst eine E-Mail an die Stadt.",
    en: "The streetlight outside your building has been broken for weeks. You write an email to the city council.",
  },
];
