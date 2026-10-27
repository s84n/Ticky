// Fragen für die Eltern-Sperre: Wissen aus dem Erwachsenenalltag (Geld, Arbeit, Wohnen, Auto, Behörden) und
// Erinnerungen aus der Kindheit der Eltern – leicht für Erwachsene, schwer für Kinder. Nur Fakten, die sich nicht
// ständig ändern. a[0] ist immer die richtige Antwort; die Reihenfolge wird beim Anzeigen gemischt.

export const PARENT_QUIZ = [
  // Geld und Bank
  { id: 'dispo', q: 'Was ist ein „Dispo“?', a: ['Ein Überziehungsrahmen für das Girokonto', 'Eine Kündigung per Einschreiben', 'Ein Gutschein vom Arbeitgeber', 'Eine Gebühr fürs Geldabheben'] },
  { id: 'schufa', q: 'Worüber gibt die Schufa Auskunft?', a: ['Über die Kreditwürdigkeit', 'Über den Impfstatus', 'Über Punkte in Flensburg', 'Über die Steuerklasse'] },
  { id: 'iban', q: 'Was ist die IBAN?', a: ['Die internationale Kontonummer', 'Die Steuer-Identifikationsnummer', 'Die PIN der Bankkarte', 'Die Nummer des Personalausweises'] },
  { id: 'lastschrift', q: 'Was passiert bei einer Lastschrift?', a: ['Der Empfänger zieht das Geld vom Konto ein', 'Man überweist das Geld selbst', 'Die Bank schenkt einem Geld', 'Man zahlt bar am Schalter'] },
  { id: 'lastschrift-frist', q: 'Wie lange kann man einer SEPA-Lastschrift ohne Begründung widersprechen?', a: ['8 Wochen', '3 Tage', '14 Tage', '1 Jahr'] },
  { id: 'skonto', q: 'Was bedeutet „Skonto“ auf einer Rechnung?', a: ['Preisnachlass bei schneller Zahlung', 'Aufschlag für Ratenzahlung', 'Versandkosten', 'Mahngebühr'] },
  { id: 'tilgung', q: 'Was ist die „Tilgung“ bei einem Kredit?', a: ['Die Rückzahlung des geliehenen Betrags', 'Die Gebühr für den Vertrag', 'Der Zinssatz pro Jahr', 'Die Kündigung des Kredits'] },
  { id: 'bauspar', q: 'Wofür schließt man typischerweise einen Bausparvertrag ab?', a: ['Für ein späteres Darlehen fürs Wohnen', 'Für die Kfz-Versicherung', 'Für die Rente mit 67', 'Für Kindergeld'] },
  { id: 'riester', q: 'Was ist die Riester-Rente?', a: ['Staatlich geförderte private Altersvorsorge', 'Eine Rente für Soldaten', 'Eine Pflichtversicherung für Autos', 'Ein Zuschuss für Studenten'] },
  { id: 'brutto', q: 'Was bedeutet „brutto“ beim Gehalt?', a: ['Vor Abzug von Steuern und Abgaben', 'Nach Abzug aller Steuern', 'Nur das Urlaubsgeld', 'Das Gehalt ohne Überstunden'] },
  { id: 'mwst', q: 'Wie hoch ist der normale Mehrwertsteuersatz in Deutschland?', a: ['19 %', '7 %', '16 %', '25 %'] },
  { id: 'mwst-ermaessigt', q: 'Welcher ermäßigte Mehrwertsteuersatz gilt z. B. für die meisten Lebensmittel?', a: ['7 %', '5 %', '10 %', '19 %'] },
  { id: 'steuerklasse', q: 'Welche Steuerklasse haben Alleinerziehende?', a: ['II', 'I', 'IV', 'VI'] },
  { id: 'pendler', q: 'Was ist die Pendlerpauschale?', a: ['Ein Steuerabzug für den Weg zur Arbeit', 'Ein Bahnticket vom Arbeitgeber', 'Eine Strafe fürs Zuspätkommen', 'Ein Zuschuss für E-Autos'] },
  { id: 'lohnsteuerbescheinigung', q: 'Wer stellt die Lohnsteuerbescheinigung aus?', a: ['Der Arbeitgeber', 'Das Bürgeramt', 'Die Krankenkasse', 'Die Hausbank'] },

  // Arbeit und Familie
  { id: 'urlaub', q: 'Wie viele Urlaubstage stehen Vollzeitkräften mit 5-Tage-Woche gesetzlich mindestens zu?', a: ['20', '15', '25', '30'] },
  { id: 'ruhezeit', q: 'Wie lang muss die Ruhezeit zwischen zwei Arbeitstagen in der Regel mindestens sein?', a: ['11 Stunden', '6 Stunden', '8 Stunden', '14 Stunden'] },
  { id: 'arbeitstag', q: 'Wie viele Stunden pro Werktag darf man laut Arbeitszeitgesetz in der Regel arbeiten?', a: ['8 (bis 10 mit Ausgleich)', '6 (bis 7 mit Ausgleich)', '12 (bis 14 mit Ausgleich)', 'Beliebig viele'] },
  { id: 'mutterschutz', q: 'Wie lange dauert der Mutterschutz nach der Geburt in der Regel?', a: ['8 Wochen', '2 Wochen', '6 Monate', '1 Jahr'] },
  { id: 'elternzeit', q: 'Wie viele Jahre Elternzeit kann man pro Kind höchstens nehmen?', a: ['3', '1', '2', '5'] },
  { id: 'kindergeld', q: 'Bei welcher Stelle beantragt man Kindergeld?', a: ['Familienkasse', 'Finanzamt', 'Jugendamt', 'Krankenkasse'] },
  { id: 'unfallvers', q: 'Wer zahlt die Beiträge zur gesetzlichen Unfallversicherung von Angestellten?', a: ['Nur der Arbeitgeber', 'Nur der Angestellte', 'Beide je zur Hälfte', 'Die Krankenkasse'] },
  { id: 'bereitschaft', q: 'Welche Nummer hat der ärztliche Bereitschaftsdienst?', a: ['116 117', '110', '115', '118 33'] },
  { id: 'bonusheft', q: 'Wie oft sollten Erwachsene zum Zahnarzt, damit das Bonusheft zählt?', a: ['Einmal im Jahr', 'Jeden Monat', 'Alle 5 Jahre', 'Nur bei Schmerzen'] },

  // Wohnen und Haushalt
  { id: 'kaltmiete', q: 'Was ist die Kaltmiete?', a: ['Die Miete ohne Neben- und Heizkosten', 'Die Miete im Winter', 'Die Miete für unbeheizte Keller', 'Die Miete inklusive Strom'] },
  { id: 'kaution', q: 'Wie hoch darf eine Mietkaution höchstens sein?', a: ['3 Monatskaltmieten', '1 Monatskaltmiete', '6 Monatskaltmieten', '12 Monatskaltmieten'] },
  { id: 'kuendigung', q: 'Welche Kündigungsfrist gilt normalerweise für Mieter?', a: ['3 Monate', '2 Wochen', '1 Monat', '1 Jahr'] },
  { id: 'nebenkosten', q: 'Was steht in der Nebenkostenabrechnung?', a: ['Die Betriebskosten der Wohnung', 'Das Gehalt des Hausmeisters allein', 'Die Grundsteuer des Nachbarn', 'Der Kaufpreis der Wohnung'] },
  { id: 'hausrat', q: 'Was ersetzt die Hausratversicherung?', a: ['Schäden an den eigenen Sachen in der Wohnung', 'Schäden, die man anderen zufügt', 'Arztkosten nach einem Unfall', 'Reparaturen am Auto'] },
  { id: 'kochwaesche', q: 'Bei wie viel Grad wäscht man Handtücher üblicherweise hygienisch?', a: ['60 °C', '20 °C', '30 °C', '120 °C'] },
  { id: 'altglas', q: 'Wann darf man Altglas meistens nicht einwerfen?', a: ['An Sonn- und Feiertagen', 'Montags', 'Bei Regen', 'Im Winter'] },
  { id: 'mehlschwitze', q: 'Woraus besteht eine Mehlschwitze?', a: ['Fett und Mehl', 'Mehl und Wasser', 'Ei und Zucker', 'Milch und Salz'] },
  { id: 'fruehstuecksei', q: 'Wie lange kocht ein weiches Frühstücksei ungefähr?', a: ['4–5 Minuten', '1 Minute', '10–12 Minuten', '20 Minuten'] },
  { id: 'widerruf', q: 'Wie lange hat man bei Online-Käufen in der Regel ein Widerrufsrecht?', a: ['14 Tage', '3 Tage', '30 Tage', '6 Monate'] },
  { id: 'gewaehrleistung', q: 'Wie lange gilt die gesetzliche Gewährleistung bei neu gekaufter Ware?', a: ['2 Jahre', '6 Monate', '1 Jahr', '5 Jahre'] },
  { id: 'rundfunk', q: 'Wie heißt die Abgabe, die die frühere GEZ-Gebühr ersetzt hat?', a: ['Rundfunkbeitrag', 'Medienabgabe', 'Fernsehsteuer', 'Antennengebühr'] },

  // Auto und Verkehr
  { id: 'flensburg', q: 'Ab wie vielen Punkten in Flensburg ist der Führerschein weg?', a: ['8', '4', '12', '18'] },
  { id: 'probezeit', q: 'Wie lange dauert die Probezeit nach dem ersten Führerschein normalerweise?', a: ['2 Jahre', '6 Monate', '1 Jahr', '5 Jahre'] },
  { id: 'promille', q: 'Ab wie viel Promille begeht man am Steuer (ohne Ausfallerscheinungen) eine Ordnungswidrigkeit?', a: ['0,5', '0,1', '0,8', '1,1'] },
  { id: 'profil', q: 'Wie tief muss das Reifenprofil beim Pkw gesetzlich mindestens sein?', a: ['1,6 mm', '0,5 mm', '3 mm', '5 mm'] },
  { id: 'winterreifen', q: 'Welche Faustregel gilt für Winterreifen?', a: ['Von O bis O (Oktober bis Ostern)', 'Von M bis M (März bis Mai)', 'Von J bis J (Juni bis Juli)', 'Von S bis S (September bis Silvester)'] },
  { id: 'tuev-neu', q: 'Wann muss ein neues Auto zum ersten Mal zur Hauptuntersuchung (TÜV)?', a: ['Nach 3 Jahren', 'Nach 1 Jahr', 'Nach 5 Jahren', 'Nach 10 Jahren'] },
  { id: 'tuev', q: 'Wie oft muss ein älterer Pkw danach zur Hauptuntersuchung?', a: ['Alle 2 Jahre', 'Jedes Jahr', 'Alle 4 Jahre', 'Alle 6 Monate'] },
  { id: 'kfz-pflicht', q: 'Welche Versicherung ist für jedes zugelassene Auto Pflicht?', a: ['Kfz-Haftpflicht', 'Vollkasko', 'Teilkasko', 'Insassenunfall'] },
  { id: 'perso', q: 'Wie lange ist ein Personalausweis ab 24 Jahren gültig?', a: ['10 Jahre', '2 Jahre', '5 Jahre', 'Lebenslang'] },

  // Erinnerungen aus der Kindheit der Eltern
  { id: 'mauer', q: 'In welchem Jahr fiel die Berliner Mauer?', a: ['1989', '1961', '1979', '1995'] },
  { id: 'euro', q: 'In welchem Jahr kamen Euro-Scheine und -Münzen in Deutschland in Umlauf?', a: ['2002', '1990', '1999', '2008'] },
  { id: 'dm', q: 'Wie viel D-Mark war ein Euro ungefähr wert?', a: ['Knapp 2 D-Mark', '1 D-Mark', '5 D-Mark', '10 D-Mark'] },
  { id: 'wind-of-change', q: 'Welche Band sang „Wind of Change“?', a: ['Scorpions', 'Die Toten Hosen', 'Modern Talking', 'Rammstein'] },
  { id: 'major-tom', q: 'Wer sang „Major Tom (völlig losgelöst)“?', a: ['Peter Schilling', 'Nena', 'Falco', 'Herbert Grönemeyer'] },
  { id: '99-luftballons', q: 'Wer sang „99 Luftballons“?', a: ['Nena', 'Sandra', 'Peter Maffay', 'Marius Müller-Westernhagen'] },
  { id: 'wetten-dass', q: 'Wer moderierte „Wetten, dass..?“ am längsten?', a: ['Thomas Gottschalk', 'Frank Elstner', 'Markus Lanz', 'Günther Jauch'] },
  { id: 'walkman', q: 'Wie hieß der tragbare Kassettenspieler von Sony?', a: ['Walkman', 'iPod', 'Discman', 'Gameboy'] },
  { id: 'bleistift', q: 'Wofür brauchte man früher oft einen Bleistift bei Kassetten?', a: ['Um das Band aufzuspulen', 'Um die Kassette zu beschriften', 'Um sie aufzuschrauben', 'Um die Lautstärke zu regeln'] },
  { id: 'tetris', q: 'Welches Spiel lag dem ersten Game Boy in Europa bei?', a: ['Tetris', 'Super Mario Bros.', 'Pac-Man', 'Pokémon'] },
  { id: 'videotext', q: 'Was war der Videotext?', a: ['Textseiten mit Nachrichten im Fernseher', 'Untertitel im Kino', 'Eine Videokassette mit Text', 'Ein Programm zum Chatten'] },
  { id: 'telefonzelle', q: 'Womit bezahlte man in den 90ern meistens an der Telefonzelle?', a: ['Telefonkarte oder Münzen', 'Handy-App', 'Kreditkarte per Funk', 'Fingerabdruck'] },
  { id: 'disketten', q: 'Wie viel passte auf eine typische 3,5-Zoll-Diskette?', a: ['1,44 MB', '1,44 GB', '144 MB', '14 KB'] },
  { id: 'modem', q: 'Was hörte man früher beim Einwählen ins Internet?', a: ['Pfeif- und Rauschgeräusche des Modems', 'Eine Melodie von Nokia', 'Eine Ansage „Willkommen“', 'Gar nichts'] },
  { id: 'nokia', q: 'Welches Spiel war auf vielen alten Nokia-Handys vorinstalliert?', a: ['Snake', 'Minecraft', 'Fortnite', 'Candy Crush'] },
];

/**
 * Wählt n verschiedene Fragen, möglichst keine aus recent (zuletzt gestellte ids).
 * Gibt [{ id, q, answers, correct }] zurück, die Antworten gemischt.
 */
export function pickQuestions(n, recent = [], rnd = Math.random) {
  const fresh = PARENT_QUIZ.filter(x => !recent.includes(x.id));
  const pool = [...(fresh.length >= n ? fresh : PARENT_QUIZ)];
  const out = [];
  while (out.length < n && pool.length) {
    const item = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const answers = [...item.a];
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    out.push({ id: item.id, q: item.q, answers, correct: item.a[0] });
  }
  return out;
}
