export function roomLink(href, id) {
  const url = new URL(href);
  if (id) url.searchParams.set('room', id);
  else url.searchParams.delete('room');
  return url.href;
}

export function sharedRoomId(href) {
  const url = new URL(href);
  return url.searchParams.has('room') ? url.searchParams.get('room') || 'invalid' : null;
}
