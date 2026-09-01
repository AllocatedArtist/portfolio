/**
 * Site-wide constants.
 *
 * Everything a visitor could contact you through lives here, so there is one
 * place to edit and no address is duplicated across templates.
 */

export const site = {
  name: "Seven Flaminiano",
  role: "Graphics and systems programmer",

  email: "sevenf.work@gmail.com",

  linkedin: "https://www.linkedin.com/in/seven-flaminiano/",

  github: "https://github.com/AllocatedArtist",

  /**
   * Served straight out of public/, so the URL is stable and the file is not
   * hashed or processed. Drop the PDF at public/resume.pdf and commit it:
   * .gitignore no longer excludes it, and if it is missing from the repo the
   * link 404s in production while working fine locally.
   */
  resume: "/resume.pdf",
} as const;

/** Nerd Font glyphs present in the subset. See src/styles/global.css. */
export const icon = {
  email: "\uF0E0", // nf-fa-envelope
  linkedin: "\uF08C", // nf-fa-linkedin, boxed. Bare mark is U+F0E1.
  resume: "\uF1C1", // nf-fa-file_pdf_o
  download: "\uF019", // nf-fa-download
  github: "\uF09B", // nf-fa-github
  external: "\uF08E", // nf-fa-external_link
} as const;
