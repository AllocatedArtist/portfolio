const UTC = "UTC";

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: UTC,
  }).format(date);
}

export function year(date: Date): string {
  return String(date.getUTCFullYear());
}

/**
 * Value for the `datetime` attribute of a <time> element. Same string as
 * isoDate, named separately so the intent reads clearly at the call site:
 *
 *   <time datetime={machineDate(d)}>{longDate(d)}</time>
 */
export function machineDate(date: Date): string {
  return isoDate(date);
}
