// State of the v2 chat-thread engine in a page or frame (Chrome Tide's KESTREL-9 thread).
export const chatState = (target) =>
  target.evaluate(() => {
    const root = document.querySelector('[data-engine="chat-thread"]');
    const lines = [...(root?.querySelectorAll('.kn-e-chat-thread__line') ?? [])];
    return {
      pending: lines.filter((l) => l.hasAttribute('data-pending')).length,
      last: lines.at(-1)?.querySelector('.kn-e-chat-thread__text')?.textContent,
      tier: root?.dataset.tier,
    };
  });
