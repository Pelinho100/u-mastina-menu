'use strict';

const menuFacebook = (() => {
  const colors = { green: '#152f29', cream: '#f3eedd', card: '#faf7eb', beige: '#e9e0c8', copper: '#8a492f', gold: '#efc98d', ink: '#222922', line: '#d9d0b9' };
  const width = 1229;
  const margin = 41;
  const leftWidth = 270;

  function lines(ctx, value, maxWidth) {
    return value.trim().split(/\s+/).filter(Boolean).flatMap(word => {
      if (ctx.measureText(word).width <= maxWidth) return word;
      const pieces = [''];
      for (const char of word) {
        if (ctx.measureText(pieces.at(-1) + char).width > maxWidth) pieces.push(char);
        else pieces[pieces.length - 1] += char;
      }
      return pieces;
    }).reduce((result, word) => {
      const last = result.at(-1);
      if (last && ctx.measureText(last + ' ' + word).width <= maxWidth) result[result.length - 1] += ' ' + word;
      else result.push(word);
      return result;
    }, []);
  }
  function render(canvas, menu, facade) {
    const ctx = canvas.getContext('2d');
    function text(value, x, y, maxWidth, size, font, color, align = 'left', leading = size * 1.12) {
      ctx.font = font.replace('@', size + 'px');
      const wrapped = lines(ctx, value || '', maxWidth);
      if (y !== null) {
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'top';
        wrapped.forEach((part, index) => ctx.fillText(part, x, y + index * leading));
      }
      return wrapped.length * leading;
    }
    const sans = '@ Arial, sans-serif', bold = 'bold @ Arial, sans-serif', serif = 'bold @ Georgia, serif';
    const bodyWidth = width - margin * 2;
    const nameX = margin + leftWidth + 67;
    const priceX = width - margin - 26;
    const nameWidth = priceX - nameX - 126;
    const parts = menu.days.map(day => {
      const soups = day.soups.map(soup => text(soup.name, 0, null, leftWidth - 40, 25, bold, colors.ink));
      const meals = day.meals.map(meal => Math.max(58,
        text(meal.name, 0, null, nameWidth, 31, bold, colors.ink) +
        text(meal.sides, 0, null, nameWidth, 24, sans, colors.ink) + 6
      ));
      return { soups, meals, height: Math.ceil(Math.max(154, 137 + soups.reduce((a,b) => a+b+2, 0), meals.reduce((a,b) => a+b, 0) + 16)) };
    });
    const legend = menu.allergens.join(' · ');
    const legendHeight = text(legend, 0, null, bodyWidth - 30, 17, sans, colors.ink);
    const hoursHeight = 228;
    const datesHeight = parts.reduce((sum, part) => sum + part.height + 12, 0);
    const footerTop = hoursHeight + 20 + datesHeight + legendHeight + 43;
    canvas.width = width;
    canvas.height = footerTop + 175;
    ctx.fillStyle = colors.cream;
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.fillStyle = colors.green;
    ctx.fillRect(0, 0, width, hoursHeight);
    ctx.drawImage(facade, 718, 0, 511, hoursHeight);
    const fade = ctx.createLinearGradient(718, 0, 817, 0);
    fade.addColorStop(0, colors.green);
    fade.addColorStop(1, 'rgba(21,47,41,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(718, 0, 100, hoursHeight);
    ctx.strokeStyle = colors.gold;
    ctx.strokeRect(29, 28, 615, 176);
    ctx.fillStyle = colors.green;
    ctx.fillRect(30, 30, 615, 175);
    text(menu.restaurant.toLocaleUpperCase('sk'), 57, 49, 650, 22, bold, colors.gold);
    const titleSize = Math.min(87, 87 * 665 / Math.max(665, (() => { ctx.font = serif.replace('@','87px'); return ctx.measureText(menu.title).width; })()));
    text(menu.title, 55, 79, 668, titleSize, serif, colors.card);
    text(menu.range, 58, 184, 380, 27, bold, colors.card);
    text(menu.hours, 455, 184, 242, 26, sans, colors.gold);
    ctx.fillStyle = colors.copper;
    ctx.fillRect(0, hoursHeight, width, 3);

    let y = hoursHeight + 20;
    menu.days.forEach((day, index) => {
      const part = parts[index];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(margin, y, bodyWidth, part.height, 12);
      ctx.clip();
      ctx.fillStyle = colors.card;
      ctx.fillRect(margin, y, bodyWidth, part.height);
      ctx.fillStyle = colors.beige;
      ctx.fillRect(margin, y, leftWidth, part.height);
      ctx.restore();
      text(day.date, margin + 19, y + 17, leftWidth - 38, 20, bold, colors.copper);
      text(day.name, margin + 18, y + 43, leftWidth - 36, 42, serif, colors.green);
      if (day.soups.length) {
        ctx.fillStyle = colors.line;
        ctx.fillRect(margin + 19, y + 95, leftWidth - 40, 1);
        text('POLIEVKA', margin + 19, y + 106, leftWidth - 38, 15, bold, colors.copper);
        let soupY = y + 126;
        day.soups.forEach(soup => {
          soupY += text(soup.name, margin + 19, soupY, leftWidth - 40, 25, bold, colors.ink) + 2;
        });
      }
      if (day.notice) text(day.notice, nameX - 42, y + 41, nameWidth, 30, bold, colors.green);
      let rowY = y + 10;
      day.meals.forEach((meal, mealIndex) => {
        if (mealIndex) {
          ctx.fillStyle = colors.line;
          ctx.fillRect(nameX - 43, rowY - 4, priceX - nameX + 43, 1);
        }
        text(String(mealIndex + 1).padStart(2, '0'), nameX - 42, rowY + 3, 35, 16, bold, colors.copper);
        const titleHeight = text(meal.name, nameX, rowY, nameWidth, 31, bold, colors.ink);
        text(meal.sides, nameX, rowY + titleHeight, nameWidth, 24, sans, colors.ink);
        text(meal.price, priceX, rowY, 116, 28, bold, colors.green, 'right');
        rowY += part.meals[mealIndex];
      });
      y += part.height + 12;
    });

    text('Alergény sú uvedené v zátvorkách.', width / 2, y + 3, bodyWidth, 20, bold, colors.green, 'center');
    text(legend, width / 2, y + 29, bodyWidth - 30, 17, sans, colors.ink, 'center');
    ctx.fillStyle = colors.green;
    ctx.fillRect(0, footerTop, width, 175);
    ctx.fillStyle = colors.copper;
    ctx.fillRect(0, footerTop, width, 3);
    const right = Math.ceil(width * .55);
    ctx.fillStyle = colors.gold;
    ctx.fillRect(right - 43, footerTop + 26, 1, 124);
    text('OBJEDNÁVKY', 57, footerTop + 26, 470, 21, bold, colors.gold);
    text(menu.phone, 57, footerTop + 52, 505, 44, bold, colors.card);
    text(menu.orderInfo, 57, footerTop + 115, 505, 22, sans, colors.card);
    text('ADRESA', right, footerTop + 26, 440, 21, bold, colors.gold);
    const addressHeight = text(menu.address, right, footerTop + 55, 500, 30, bold, colors.card);
    text(menu.city, right, footerTop + 63 + addressHeight, 500, 22, sans, colors.card);
  }

  async function download(menu) {
    const facade = new Image();
    facade.src = 'menu-facebook-fasada.jpg';
    await facade.decode();
    const canvas = document.createElement('canvas');
    render(canvas, menu, facade);
    const image = await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Obrázok sa nepodarilo vytvoriť.'));
    }, 'image/png'));
    const url = URL.createObjectURL(image);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'U-Mastina-Facebook-' + menu.start + '.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return { download };
})();
