import joplin from "api";

export namespace folderNoteLinks {
  export async function init() {
    console.log("Folder Note Links plugin started!");

    //Register settings
  }

  export async function autoLink() {
    //Get all the folders
    const folders = await joplin.data.get(["folders"]);
    console.log("folders", folders);

    //Check in all the folders if there is already a "node" note
    //and create one if there is not

    //Link every folder "node" note to his parent "node" note

    //Get all the notes
    const notes = await joplin.data.get(["notes"]);
    console.log("notes", notes);

    //Check if the notes are already linked to a "node"
    //If there was already a link, check if the link is to his parent "node",
    //if the link is not to his parent, update the link, else, do nothing
    //If the note has no link to a "node" note, create a link on the bottom of the note
    //Don't link the "node" note to himself
  }
}

export default folderNoteLinks;
