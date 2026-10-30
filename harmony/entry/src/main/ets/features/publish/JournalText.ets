/** Extra v47 fields travel as readable text in the existing description contract. */
export class JournalText {
  story: string = '';
  subtitle: string = '';
  delivery: string = '';
  people: string = '';
  negotiable: boolean = false;
  static readonly marker: string = '\n\n【Portra 拍摄补充 v1】\n';

  static encode(story: string, subtitle: string, delivery: string, people: string, negotiable: boolean): string {
    return JournalText.pack(JournalText.decode(story).story, subtitle, delivery, people, negotiable);
  }

  private static pack(story: string, subtitle: string, delivery: string, people: string, negotiable: boolean): string {
    const extra: string[] = [];
    if (subtitle.trim()) { extra.push(`一句话介绍：${subtitle.trim()}`); }
    if (people.trim()) { extra.push(`参与人数：${people.trim()}`); }
    if (negotiable) { extra.push('预算：可根据拍摄方案再沟通'); }
    if (delivery.trim()) { extra.push(`交付说明：${delivery.trim()}`); }
    return story.trim() + (extra.length > 0 ? JournalText.marker + extra.join('\n') : '');
  }

  static decode(value: string = ''): JournalText {
    const result = new JournalText();
    const at = value.indexOf(JournalText.marker);
    result.story = at < 0 ? value : value.slice(0, at);
    if (at < 0) { return result; }
    const lines = value.slice(at + JournalText.marker.length).split('\n');
    let deliveryStarted = false;
    for (const line of lines) {
      if (deliveryStarted) { result.delivery += '\n' + line; }
      else if (line.startsWith('一句话介绍：')) { result.subtitle = line.slice(6); }
      else if (line.startsWith('参与人数：')) { result.people = line.slice(5); }
      else if (line === '预算：可根据拍摄方案再沟通') { result.negotiable = true; }
      else if (line.startsWith('交付说明：')) { result.delivery = line.slice(5); deliveryStarted = true; }
    }
    // Only interpret a complete canonical block written by this client. Ordinary
    // legacy prose containing a similar heading must remain visible and editable.
    if (JournalText.pack(result.story, result.subtitle, result.delivery, result.people, result.negotiable) !== value.trim()) {
      const legacy = new JournalText(); legacy.story = value; return legacy;
    }
    return result;
  }
}
