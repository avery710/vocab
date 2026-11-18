import { describe, expect, it } from "vitest";
import { parseNotionCsv, parseNotionDate, parseRelations } from "@/lib/notion-import";

// Shaped like Notion's "Markdown & CSV" export of the English Dictionary.
const CSV =
  "﻿Word/Phrase,Chinese Definition,Date Added,Definition,Example Sentence,Example Sentence (Chinese),Note,Part of Speech,Pronunciation,Related words,Tags\n" +
  'apt,"恰當的、貼切的；容易……的、傾向於……的（apt to）","October 24, 2026","Suitable or appropriate; or having a tendency to do something (apt to).",That was an apt description of the situation.,那是對這個情況很貼切的描述。,"apt to + 動詞原形：傾向於, 容易",adjective,/æpt/,"fitting (https://www.notion.so/fitting-3df4dee335c58159b119dff45423769b?pvs=21)","casual, academic"\n' +
  'fitting,合適的,2026-09-18,Suitable,,,,adjective,,"apt (https://www.notion.so/apt-4034dee335c58176b6ddf0137e02a96f?pvs=21)",\n' +
  ",empty row,,,,,,,,,\n" +
  "APT,dupe,,,,,,,,,\n" +
  'thingamajig,東西,,,,,,whatchamacallit,,,"Slang"\n';

describe("Notion CSV import", () => {
  it("parses dates in Notion's formats", () => {
    expect(parseNotionDate("October 24, 2026")).toBe("2026-10-24");
    expect(parseNotionDate("Sep 3, 2026")).toBe("2026-09-03");
    expect(parseNotionDate("2026-09-18")).toBe("2026-09-18");
    expect(parseNotionDate("")).toBeUndefined();
  });

  it("reads relation titles out of 'title (url)' lists", () => {
    expect(parseRelations("calf (https://www.notion.so/calf-1?pvs=21), thigh (https://www.notion.so/thigh-2)")).toEqual(["calf", "thigh"]);
    expect(parseRelations("calf, thigh")).toEqual(["calf", "thigh"]);
    expect(parseRelations("https://www.notion.so/x")).toEqual([]);
  });

  it("maps every column and reports what it skipped", () => {
    const { rows, skipped } = parseNotionCsv(CSV);
    expect(rows.map((r) => r.word.term)).toEqual(["apt", "fitting", "thingamajig"]);
    expect(rows[0].word).toMatchObject({
      pronunciation: "/æpt/",
      partOfSpeech: "adjective",
      chineseDefinition: "恰當的、貼切的；容易……的、傾向於……的（apt to）",
      exampleZh: "那是對這個情況很貼切的描述。",
      note: "apt to + 動詞原形：傾向於, 容易",
      tags: ["casual", "academic"],
      dateAdded: "2026-10-24",
    });
    expect(rows[0].related).toEqual(["fitting"]);
    expect(rows[2].word).toMatchObject({ partOfSpeech: "other", tags: ["slang"] });
    expect(skipped.map((s) => s.line)).toEqual([4, 5]);
  });
});
