'use strict';

// Produce fixed A4 pages before opening the system PDF viewer. This avoids
// paginating the editor itself and keeps the same page count on mobile.
const menuPrint = (() => {
  const pointsPerMm = 72 / 25.4;
  const pageWidth = 210 * pointsPerMm;
  const pageHeight = 297 * pointsPerMm;
  const margin = 12 * pointsPerMm;
  const width = pageWidth - 2 * margin;
  const height = pageHeight - 2 * margin;

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.trim().split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const letter of word) {
        if (line && ctx.measureText(line + letter).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += letter;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function makePage(draw) {
    const canvas = document.createElement('canvas');
    const ratio = 3;
    canvas.width = Math.ceil(pageWidth * ratio);
    canvas.height = Math.ceil(pageHeight * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / pageWidth, canvas.height / pageHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.fillStyle = '#171717';
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 0.65;
    ctx.translate(margin, margin);
    draw(ctx);
    const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]), char => char.charCodeAt(0));
    const image = { jpeg, width: canvas.width, height: canvas.height };
    canvas.width = canvas.height = 1;
    return image;
  }

  function pageLayout(ctx, section, footer, kitchen, width) {
    const commands = [];
    function label(text, x, y, maxWidth, size, font = 'Arial', weight = '', align = 'left') {
      if (!text) return y;
      const style = [weight, size + 'px', font].filter(Boolean).join(' ');
      ctx.font = style;
      const lines = wrap(ctx, text, maxWidth);
      commands.push(() => {
        ctx.font = style;
        ctx.textAlign = align;
        lines.forEach((line, i) => ctx.fillText(line, x, y + size + i * size * 1.23));
      });
      return y + lines.length * size * 1.23;
    }
    function rule(y) {
      commands.push(() => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });
    }
    let y = 0;
    if (!kitchen) {
      const header = section.querySelector('.paper-header');
      label('◇', width / 2, y, width, 11, 'Georgia', '', 'center');
      y += 18;
      y = label(header.querySelector('.restaurant')?.textContent, width / 2, y, width, 11, 'Georgia', 'bold', 'center') + 3;
      y = label(header.querySelector('h2').textContent, width / 2, y, width, 38, 'Georgia', '', 'center') + 3;
      const marker = header.querySelector('.allergen-draft')?.textContent;
      if (marker) y = label(marker, width / 2, y, width, 10, 'Arial', 'bold', 'center') + 5;
      y = label(Array.from(header.querySelectorAll('.paper-range span'), item => item.textContent).join('  ·  '), width / 2, y, width, 10, 'Arial', 'bold', 'center') + 15;
    }
    const days = kitchen ? [section] : section.querySelectorAll('.print-day');
    for (const day of days) {
      const heading = day.querySelector(kitchen ? 'h2' : 'h3');
      const headingSize = kitchen ? 36 : 16;
      const headingEnd = label(heading.querySelector('span').textContent, 0, y, width * 0.58, headingSize, 'Georgia', 'bold');
      const dateEnd = label(heading.querySelector('time').textContent, width, y + (kitchen ? 13 : 4), width * 0.4, kitchen ? 18 : 9, 'Arial', 'bold', 'right');
      y = Math.max(headingEnd, dateEnd) + 4;
      rule(y);
      y += kitchen ? 10 : 4;
      for (const group of day.querySelectorAll('.print-group')) {
        y = label(group.querySelector('h4').textContent.toLocaleUpperCase('sk'), 0, y, width, kitchen ? 14 : 8, 'Arial', 'bold') + 3;
        const rows = [...group.querySelectorAll('.print-row')];
        const columns = kitchen ? 1 : 2;
        const gap = 18;
        const columnWidth = (width - (columns - 1) * gap) / columns;
        for (let i = 0; i < rows.length; i += columns) {
          let end = y;
          for (const [j, row] of rows.slice(i, i + columns).entries()) {
            const x = j * (columnWidth + gap);
            const size = kitchen ? 29 : 10.5;
            const price = row.querySelector('.print-price').textContent.trim();
            ctx.font = 'bold ' + size + 'px Arial';
            const priceWidth = price ? ctx.measureText(price).width + 8 : 0;
            const nameEnd = label(row.querySelector('strong').textContent, x, y, columnWidth - priceWidth, size, 'Arial', 'bold');
            label(price, x + columnWidth, y, priceWidth, size, 'Arial', 'bold', 'right');
            const sidesEnd = label(row.querySelector('small')?.textContent, x, nameEnd + 2, columnWidth, kitchen ? 23 : 9, 'Georgia', 'italic');
            const allergensEnd = label(row.querySelector('.print-allergens')?.textContent, x, sidesEnd, columnWidth, 8.5, 'Arial', 'bold');
            end = Math.max(end, allergensEnd);
          }
          y = end + (kitchen ? 13 : 3);
        }
        y += kitchen ? 8 : 3;
      }
      if (kitchen && !day.querySelector('.print-row')) {
        y = label(day.querySelector('.empty-print')?.textContent, 0, y, width, 18);
      }
      y += kitchen ? 0 : 5;
    }
    const bodyEnd = y;
    const bodyCommands = commands.length;
    let footerHeight = 0;
    if (footer) {
      rule(y);
      y += 5;
      for (const item of footer.querySelectorAll('h3, .order-details, p')) {
        const isHeading = item.matches('h3');
        const isOrder = item.matches('.order-details');
        const content = isOrder ? [...item.children].map(child => child.textContent).join('  ·  ') : item.textContent;
        y = label(content, width / 2, y, width - 8, isOrder ? 13 : isHeading ? 8.5 : 9.5, 'Arial', isHeading || isOrder ? 'bold' : '', 'center') + 2;
      }
      footerHeight = y - bodyEnd;
    }
    return { commands, bodyCommands, bodyEnd, footerHeight };
  }

  function paint(ctx, section, footer, kitchen) {
    if (!kitchen) {
      ctx.strokeRect(-14, -14, width + 28, height + 28);
    }
    const fits = (layout, scale) =>
      (layout.bodyEnd + layout.footerHeight + (footer ? 12 : 0)) * scale <= height;
    let fit = 1;
    let layout = pageLayout(ctx, section, footer, kitchen, width);
    if (!fits(layout, fit)) {
      let upper = 1;
      fit = Math.min(1, height / (layout.bodyEnd + layout.footerHeight + 12));
      layout = pageLayout(ctx, section, footer, kitchen, width / fit);
      for (let i = 0; i < 8; i++) {
        const scale = (fit + upper) / 2;
        const candidate = pageLayout(ctx, section, footer, kitchen, width / scale);
        if (fits(candidate, scale)) {
          fit = scale;
          layout = candidate;
        } else {
          upper = scale;
        }
      }
    }
    const { commands, bodyCommands, bodyEnd, footerHeight } = layout;
    ctx.scale(fit, fit);
    // Draw the body first, then shift the footer down to the lower margin.
    if (!footer) {
      commands.forEach(draw => draw());
      return;
    }
    commands.slice(0, bodyCommands).forEach(draw => draw());
    ctx.translate(0, height / fit - bodyEnd - footerHeight);
    commands.slice(bodyCommands).forEach(draw => draw());
  }

  function pdf(images) {
    // The PDF contains one JPEG per page. Offsets count bytes, including
    // binary streams, so standard PDF viewers can locate every page.
    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [0];
    let length = 0;
    function append(part) {
      const bytes = typeof part === 'string' ? encoder.encode(part) : part;
      parts.push(bytes);
      length += bytes.length;
    }
    function object(id, ...body) {
      offsets[id] = length;
      append(id + ' 0 obj\n');
      body.forEach(append);
      append('\nendobj\n');
    }
    append('%PDF-1.4\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = images.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    object(2, '<< /Type /Pages /Count ' + images.length + ' /Kids [' + kids + '] >>');
    images.forEach((image, i) => {
      const id = 3 + i * 3;
      object(id, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight +
        '] /Resources << /XObject << /Menu ' + (id + 1) + ' 0 R >> >> /Contents ' + (id + 2) + ' 0 R >>');
      object(id + 1, '<< /Type /XObject /Subtype /Image /Width ' + image.width + ' /Height ' + image.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.jpeg.length +
        ' >>\nstream\n', image.jpeg, '\nendstream');
      const contents = 'q\n' + pageWidth + ' 0 0 ' + pageHeight + ' 0 0 cm\n/Menu Do\nQ\n';
      object(id + 2, '<< /Length ' + contents.length + ' >>\nstream\n' + contents + 'endstream');
    });
    const xref = length;
    append('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
    offsets.slice(1).forEach(offset => append(String(offset).padStart(10, '0') + ' 00000 n \n'));
    append('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  function open(sections, kitchen = false) {
    if (!sections.length) return;
    const images = sections.map(section => makePage(ctx => paint(ctx, section, section.querySelector('.paper-footer'), kitchen)));
    const url = URL.createObjectURL(pdf(images));
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  }
  return { open };
})();
