import joplin from "api";
import { folderNoteLinks } from "./folderNoteLinks";

joplin.plugins.register({
  onStart: async function () {
    await folderNoteLinks.init();
    await folderNoteLinks.autoLink();
  },
});
