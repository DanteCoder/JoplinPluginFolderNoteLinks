import joplin from "api";

export namespace folderNoteLinks {
  export async function init() {
    console.log("Folder Note Links plugin started!");

    //Register settings
  }

  export async function autoLink() {
    //Get all the folders
    const folders = (await joplin.data.get(["folders"])).items;
    console.log("folders", folders);

    //Get all the notes
    const notes = (await joplin.data.get(["notes"])).items;
    console.log("notes", notes);

    //Create the genealogy of every folder
    const genealogies = [];
    for (const folder of folders) {
      genealogies.push(folderGenealogy(folder, folders));
    }
    console.log("genealogies", genealogies);

    //Create the folderTree
    const folderTree = createFolderTree(genealogies);
    console.log("folderTree", folderTree);

    //Check in all the folders if there is already a "node" note
    //and create one if there is not

    //Link every folder "node" note to his parent "node" note

    //Check if the notes are already linked to a "node"
    //If there was already a link, check if the link is to his parent "node",
    //if the link is not to his parent, update the link, else, do nothing
    //If the note has no link to a "node" note, create a link on the bottom of the note
    //Don't link the "node" note to himself
  }

  function folderGenealogy(childFolder: any, folders: Array<any>) {
    // This function creates an array of folders that are linked
    // through the parent - child relationship
    const genealogy = [childFolder];

    while (genealogy[genealogy.length - 1] !== "") {
      const parent = folders.find(
        (parent) => parent.id === genealogy[genealogy.length - 1].parent_id
      );

      if (typeof parent === "undefined") break;

      genealogy.push(parent);
    }

    return genealogy.reverse();
  }

  function createFolderTree(genealogies: any[]) {
    // Create the folder tree from the genealogies of every folder
    const folderTree = {};

    for (const genealogy of genealogies) {
      //Recursively create folder branches from top to bottom
      createBranch(folderTree, genealogy);
    }

    function createBranch(folderTree: any, genealogy: Array<any>) {
      const parentFolders = Object.keys(folderTree);

      if (genealogy.length === 0) return;

      if (parentFolders.indexOf(genealogy[0].id) === -1) {
        folderTree[genealogy[0].id] = {
          folder: genealogy[0],
          notes: {},
        };
      }

      createBranch(folderTree[genealogy[0].id], genealogy.slice(1));
    }

    return folderTree;
  }
}

export default folderNoteLinks;
