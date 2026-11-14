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
    function rule(y, x = 0, end = width, thickness = 0.65) {
      commands.push(() => {
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(end, y);
        ctx.stroke();
      });
    }
    let y = 0;
    if (!kitchen) {
      const header = section.querySelector('.paper-header');
      rule(y, 0, width, 1.8);
      y += 9;
      const restaurant = header.querySelector('.restaurant')?.textContent;
      if (restaurant) y = label(restaurant.toLocaleUpperCase('sk'), 0, y, width, 9, 'Arial', 'bold') + 3;
      y = label(header.querySelector('h2').textContent, 0, y, width, 37, 'Georgia') + 4;
      const [dates, hours] = [...header.querySelectorAll('.paper-range span')].map(item => item.textContent);
      y = Math.max(
        label(dates, 0, y, width * 0.65, 10, 'Arial', 'bold'),
        label(hours, width, y, width * 0.31, 10, 'Arial', 'bold', 'right')
      ) + 11;
    }
    const days = kitchen ? [section] : section.querySelectorAll('.print-day');
    for (const day of days) {
      const heading = day.querySelector(kitchen ? 'h2' : 'h3');
      const headingSize = kitchen ? 36 : 16;
      if (!kitchen) {
        rule(y);
        y += 2;
      }
      const headingEnd = label(heading.querySelector('span').textContent, 0, y, width * 0.58, headingSize, 'Georgia', 'bold');
      const dateEnd = label(heading.querySelector('time').textContent, width, y + (kitchen ? 13 : 4), width * 0.4, kitchen ? 18 : 9, 'Arial', 'bold', 'right');
      y = Math.max(headingEnd, dateEnd) + (kitchen ? 4 : 2);
      if (kitchen) {
        rule(y);
        y += 10;
      }
      for (const group of day.querySelectorAll('.print-group')) {
        const title = group.querySelector('h4').textContent.toLocaleUpperCase('sk');
        const soupBand = !kitchen && group.matches('.print-soups');
        let x = 0;
        let right = width;
        let bandEnd;
        if (soupBand) {
          const bandStart = y;
          commands.push(() => {
            ctx.save();
            ctx.fillStyle = '#eee';
            ctx.fillRect(0, bandStart, width, bandEnd - bandStart);
            ctx.restore();
          });
          y += 3;
          label(title, 6, y + 1, 48, 7.5, 'Arial', 'bold');
          x = 58;
          right -= 6;
        } else if (kitchen) {
          y = label(title, 0, y, width, 14, 'Arial', 'bold') + 3;
        }
        for (const row of group.querySelectorAll('.print-row')) {
          const size = kitchen ? 29 : 10;
          const price = row.querySelector('.print-price').textContent.trim();
          const allergens = row.querySelector('.print-allergens')?.textContent;
          const inlineAllergens = soupBand && !price;
          const rightText = inlineAllergens ? allergens : price;
          const rightSize = inlineAllergens ? 8 : size;
          ctx.font = (inlineAllergens ? '' : 'bold ') + rightSize + 'px Arial';
          const rightWidth = rightText ? Math.min((right - x) * 0.43, ctx.measureText(rightText).width + 2) : 0;
          const nameEnd = label(row.querySelector('strong').textContent, x, y, right - x - (rightWidth ? rightWidth + 6 : 0), size, 'Arial', 'bold');
          const rightEnd = label(rightText, right, y + (inlineAllergens ? 1 : 0), rightWidth, rightSize, 'Arial', inlineAllergens ? '' : 'bold', 'right');
          const detailStart = Math.max(nameEnd, rightEnd);
          const sides = row.querySelector('small')?.textContent;
          if (kitchen) {
            y = label(sides, x, detailStart + (sides ? 2 : 0), right - x, 23, 'Georgia', 'italic') + 13;
          } else {
            const codes = inlineAllergens ? '' : allergens;
            ctx.font = '8px Arial';
            const codeWidth = codes ? Math.min((right - x) * 0.43, ctx.measureText(codes).width + 2) : 0;
            const sidesEnd = label(sides, x + 9, detailStart, right - x - 9 - (codeWidth ? codeWidth + 6 : 0), 8.5);
            const codeEnd = label(codes, right, detailStart, codeWidth, 8, 'Arial', '', 'right');
            y = Math.max(sidesEnd, codeEnd) + 2;
          }
        }
        if (soupBand) bandEnd = y + 1;
        y += kitchen ? 8 : 2;
      }
      if (kitchen && !day.querySelector('.print-row')) {
        y = label(day.querySelector('.empty-print')?.textContent, 0, y, width, 18);
      }
      if (!kitchen) y += 3;
    }
    const bodyEnd = y;
    const bodyCommands = commands.length;
    let footerHeight = 0;
    if (footer) {
      const legend = footer.querySelector('.allergen-legend')?.textContent;
      if (legend) y = label(legend, 0, y, width, 7.5) + 5;
      const order = footer.querySelector('.paper-orders');
      const contact = footer.querySelector('.paper-contact');
      const column = (width - 12) / 2;
      if (order || contact) rule(y);
      const footerBlock = (block, x, align) => {
        if (!block) return y;
        let next = label(block.querySelector('h3').textContent.toLocaleUpperCase('sk'), x, y + 5, column, 8, 'Arial', 'bold', align);
        const details = [...block.querySelectorAll('.order-details strong')].map(item => item.textContent).join('  ·  ');
        if (details) next = label(details, x, next, column, 11, 'Arial', 'bold', align);
        return label(block.querySelector('p')?.textContent, x, next, column, 8.5, 'Arial', '', align);
      };
      y = Math.max(footerBlock(order, 0, 'left'), footerBlock(contact, width, 'right'));
      const note = footer.querySelector('.paper-note')?.textContent;
      if (note) y = label(note, 0, y + 3, width, 8.5, 'Arial', 'italic');
      footerHeight = y - bodyEnd;
    }
    return { commands, bodyCommands, bodyEnd, footerHeight };
  }

  function paint(ctx, section, footer, kitchen) {
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
