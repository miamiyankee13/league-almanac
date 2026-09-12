const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 28;
const CARD_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CARD_HEIGHT = 326;
const CARD_GAP = 12;
const FIRST_CARD_TOP = 78;

const COLORS = {
  text: [0.11, 0.13, 0.16],
  dim: [0.37, 0.41, 0.47],
  line: [0.82, 0.83, 0.85],
  panel: [0.975, 0.975, 0.97],
  panel2: [0.945, 0.947, 0.95],
  amber: [0.66, 0.46, 0.06],
  amberSoft: [0.985, 0.965, 0.91],
  white: [1, 1, 1],
};

function ascii(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(value) {
  return ascii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function colorCommand(color, stroke = false) {
  const [r, g, b] = color;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? "RG" : "rg"}`;
}

function estimateWidth(text, fontSize, bold = false) {
  const factor = bold ? 0.56 : 0.52;
  return ascii(text).length * fontSize * factor;
}

function fitFontSize(text, maxWidth, preferred, min, bold = false) {
  let size = preferred;
  while (size > min && estimateWidth(text, size, bold) > maxWidth) {
    size -= 0.5;
  }
  return Math.max(min, size);
}

function truncateToWidth(text, maxWidth, fontSize, bold = false) {
  const clean = ascii(text);
  if (estimateWidth(clean, fontSize, bold) <= maxWidth) return clean;

  let shortened = clean;
  while (
    shortened.length > 1 &&
    estimateWidth(`${shortened}...`, fontSize, bold) > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
}

function wrapText(text, maxWidth, fontSize, maxLines = 3, bold = false) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, fontSize, bold) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = truncateToWidth(
      `${lines[lines.length - 1]}...`,
      maxWidth,
      fontSize,
      bold
    );
  }

  return lines.slice(0, maxLines);
}

function createPage() {
  const commands = [];

  function rect(x, top, width, height, { fill = null, stroke = null, lineWidth = 1 } = {}) {
    const y = PAGE_HEIGHT - top - height;
    if (fill) commands.push(colorCommand(fill));
    if (stroke) commands.push(colorCommand(stroke, true));
    commands.push(`${lineWidth.toFixed(2)} w`);
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
  }

  function line(x1, top1, x2, top2, color = COLORS.line, lineWidth = 1) {
    const y1 = PAGE_HEIGHT - top1;
    const y2 = PAGE_HEIGHT - top2;
    commands.push(colorCommand(color, true));
    commands.push(`${lineWidth.toFixed(2)} w`);
    commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  function text(
    value,
    x,
    baselineTop,
    {
      size = 10,
      bold = false,
      color = COLORS.text,
      align = "left",
      maxWidth = null,
    } = {}
  ) {
    let rendered = ascii(value);
    let drawSize = size;

    if (maxWidth) {
      drawSize = fitFontSize(rendered, maxWidth, size, Math.max(6.5, size - 5), bold);
      rendered = truncateToWidth(rendered, maxWidth, drawSize, bold);
    }

    const width = estimateWidth(rendered, drawSize, bold);
    let drawX = x;
    if (align === "center") drawX = x - width / 2;
    if (align === "right") drawX = x - width;

    const y = PAGE_HEIGHT - baselineTop;
    commands.push("BT");
    commands.push(`/${bold ? "F2" : "F1"} ${drawSize.toFixed(2)} Tf`);
    commands.push(colorCommand(color));
    commands.push(`1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm`);
    commands.push(`(${pdfEscape(rendered)}) Tj`);
    commands.push("ET");
  }

  function wrappedText(
    value,
    x,
    baselineTop,
    maxWidth,
    {
      size = 10,
      bold = false,
      color = COLORS.text,
      lineHeight = size * 1.25,
      maxLines = 3,
      align = "left",
    } = {}
  ) {
    const lines = wrapText(value, maxWidth, size, maxLines, bold);
    lines.forEach((entry, index) => {
      text(entry, x, baselineTop + index * lineHeight, {
        size,
        bold,
        color,
        align,
        maxWidth,
      });
    });
    return lines.length;
  }

  return {
    rect,
    line,
    text,
    wrappedText,
    output: () => commands.join("\n"),
  };
}

function drawDocumentHeader(page, data, pageNumber, pageCount) {
  page.text("LEAGUE ALMANAC / WEEKLY MATCHUP STUDIO", MARGIN, 31, {
    size: 7.5,
    bold: true,
    color: COLORS.dim,
  });

  page.text(data.leagueName, MARGIN, 51, {
    size: 17,
    bold: true,
    color: COLORS.text,
    maxWidth: 365,
  });

  page.text(`${data.season} / WEEK ${data.week}`, PAGE_WIDTH - MARGIN, 51, {
    size: 9,
    bold: true,
    color: COLORS.amber,
    align: "right",
  });

  page.line(MARGIN, 62, PAGE_WIDTH - MARGIN, 62, COLORS.line, 0.8);

  page.text(`PAGE ${pageNumber} OF ${pageCount}`, PAGE_WIDTH - MARGIN, 775, {
    size: 6.5,
    color: COLORS.dim,
    align: "right",
  });

  page.text(
    "Recorded H2H uses matchup-level history plus known commissioner-entered championship results.",
    MARGIN,
    775,
    { size: 6.5, color: COLORS.dim, maxWidth: 440 }
  );
}

function drawCompareRow(page, top, label, left, right) {
  const center = MARGIN + CARD_WIDTH / 2;
  page.text(left, MARGIN + 18, top + 14, {
    size: 10,
    bold: true,
    color: COLORS.text,
    maxWidth: 130,
  });
  page.text(label, center, top + 13.5, {
    size: 6.5,
    bold: true,
    color: COLORS.dim,
    align: "center",
    maxWidth: 190,
  });
  page.text(right, PAGE_WIDTH - MARGIN - 18, top + 14, {
    size: 10,
    bold: true,
    color: COLORS.text,
    align: "right",
    maxWidth: 130,
  });
}

function drawMatchupCard(page, matchup, week, top) {
  const x = MARGIN;
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const center = x + w / 2;
  const leftCenter = x + w * 0.25;
  const rightCenter = x + w * 0.75;

  page.rect(x, top, w, h, {
    fill: COLORS.white,
    stroke: COLORS.line,
    lineWidth: 0.9,
  });
  page.rect(x, top, 3, h, { fill: COLORS.amber });
  page.rect(x + 3, top, w - 3, 22, { fill: COLORS.panel2 });

  page.text(`WEEK ${week}`, x + 12, top + 14.5, {
    size: 7,
    bold: true,
    color: COLORS.amber,
  });
  page.text(`MATCHUP ${matchup.displayNumber}`, x + w - 12, top + 14.5, {
    size: 7,
    bold: true,
    color: COLORS.dim,
    align: "right",
  });

  const leftTeamSize = fitFontSize(matchup.sideA.teamName, w * 0.37, 15, 9, true);
  const rightTeamSize = fitFontSize(matchup.sideB.teamName, w * 0.37, 15, 9, true);

  page.text(matchup.sideA.teamName, leftCenter, top + 48, {
    size: leftTeamSize,
    bold: true,
    color: COLORS.text,
    align: "center",
    maxWidth: w * 0.39,
  });
  page.text(matchup.sideB.teamName, rightCenter, top + 48, {
    size: rightTeamSize,
    bold: true,
    color: COLORS.text,
    align: "center",
    maxWidth: w * 0.39,
  });

  page.text(matchup.sideA.managerName, leftCenter, top + 63, {
    size: 8.5,
    color: COLORS.dim,
    align: "center",
    maxWidth: w * 0.39,
  });
  page.text(matchup.sideB.managerName, rightCenter, top + 63, {
    size: 8.5,
    color: COLORS.dim,
    align: "center",
    maxWidth: w * 0.39,
  });

  page.text("VS", center, top + 57, {
    size: 8,
    bold: true,
    color: COLORS.amber,
    align: "center",
  });

  page.text(matchup.sideA.seasonRecord, leftCenter, top + 83, {
    size: 14,
    bold: true,
    color: COLORS.text,
    align: "center",
  });
  page.text(matchup.sideB.seasonRecord, rightCenter, top + 83, {
    size: 14,
    bold: true,
    color: COLORS.text,
    align: "center",
  });

  page.text("CURRENT RECORD", leftCenter, top + 94, {
    size: 6,
    bold: true,
    color: COLORS.dim,
    align: "center",
  });
  page.text("CURRENT RECORD", rightCenter, top + 94, {
    size: 6,
    bold: true,
    color: COLORS.dim,
    align: "center",
  });

  const compareTop = top + 103;
  page.line(x + 3, compareTop, x + w, compareTop, COLORS.line, 0.7);
  drawCompareRow(
    page,
    compareTop,
    "CAREER RECORD",
    matchup.sideA.careerRecord,
    matchup.sideB.careerRecord
  );
  page.line(x + 3, compareTop + 20, x + w, compareTop + 20, COLORS.line, 0.5);
  drawCompareRow(
    page,
    compareTop + 20,
    "TITLES",
    String(matchup.sideA.championships),
    String(matchup.sideB.championships)
  );
  page.line(x + 3, compareTop + 40, x + w, compareTop + 40, COLORS.line, 0.5);
  drawCompareRow(
    page,
    compareTop + 40,
    "PLAYOFF APPEARANCES",
    String(matchup.sideA.playoffAppearances),
    String(matchup.sideB.playoffAppearances)
  );
  page.line(x + 3, compareTop + 60, x + w, compareTop + 60, COLORS.line, 0.7);

  const historyTop = compareTop + 60;
  const historyWidth = (w - 3) / 2;
  page.rect(x + 3, historyTop, w - 3, 47, { fill: COLORS.panel });
  page.line(center, historyTop, center, historyTop + 47, COLORS.line, 0.6);

  page.text("RECORDED SERIES", x + 15, historyTop + 14, {
    size: 6.3,
    bold: true,
    color: COLORS.dim,
  });
  page.text("PLAYOFF H2H", center + 12, historyTop + 14, {
    size: 6.3,
    bold: true,
    color: COLORS.dim,
  });

  page.wrappedText(matchup.seriesLabel, x + 15, historyTop + 30, historyWidth - 28, {
    size: 9.5,
    bold: true,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });
  page.wrappedText(
    matchup.playoffSeriesLabel,
    center + 12,
    historyTop + 30,
    historyWidth - 28,
    {
      size: 9.5,
      bold: true,
      color: COLORS.text,
      maxLines: 2,
      lineHeight: 10,
    }
  );

  const lastTop = historyTop + 47;
  page.line(x + 3, lastTop, x + w, lastTop, COLORS.line, 0.6);
  page.text("LAST MEETING", x + 15, lastTop + 13, {
    size: 6.3,
    bold: true,
    color: COLORS.dim,
  });
  page.text(matchup.lastMeetingLabel, x + 15, lastTop + 29, {
    size: 8.8,
    bold: true,
    color: COLORS.text,
    maxWidth: w - 30,
  });

  const noteTop = lastTop + 37;
  const noteHeight = top + h - noteTop;
  page.rect(x + 3, noteTop, w - 3, noteHeight, { fill: COLORS.amberSoft });
  page.text("MATCHUP NOTE", x + 15, noteTop + 14, {
    size: 6.3,
    bold: true,
    color: COLORS.amber,
  });
  page.wrappedText(matchup.narrative, x + 15, noteTop + 32, w - 30, {
    size: 10.2,
    bold: true,
    color: COLORS.text,
    maxLines: 3,
    lineHeight: 12.5,
  });
}

function buildPdfBytes(pageContents) {
  const objects = [];
  const pageObjectIds = [];

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  for (let i = 0; i < pageContents.length; i += 1) {
    const pageId = 5 + i * 2;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);

    const stream = `${pageContents[i]}\n`;
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n%1234\n";
  const offsets = [0];

  for (let id = 1; id <= objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id - 1]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

function pdfFilename(data) {
  const league = ascii(data.leagueName || "league")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "league";

  return `${league}-${data.season}-week-${data.week}-tale-of-the-tape.pdf`;
}

export function createWeeklyMatchupPdf(data) {
  if (!data?.available || !data?.matchups?.length) {
    throw new Error("No weekly matchups are available to generate a PDF.");
  }

  const pageCount = Math.ceil(data.matchups.length / 2);
  const pageContents = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = createPage();
    drawDocumentHeader(page, data, pageIndex + 1, pageCount);

    const firstMatchup = data.matchups[pageIndex * 2];
    const secondMatchup = data.matchups[pageIndex * 2 + 1];

    if (firstMatchup) {
      drawMatchupCard(page, firstMatchup, data.week, FIRST_CARD_TOP);
    }

    if (secondMatchup) {
      drawMatchupCard(
        page,
        secondMatchup,
        data.week,
        FIRST_CARD_TOP + CARD_HEIGHT + CARD_GAP
      );
    }

    pageContents.push(page.output());
  }

  const bytes = buildPdfBytes(pageContents);
  const filename = pdfFilename(data);
  const blob = new Blob([bytes], { type: "application/pdf" });

  return { blob, filename };
}
