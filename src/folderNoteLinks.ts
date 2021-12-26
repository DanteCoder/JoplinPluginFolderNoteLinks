import joplin from "api";

export namespace folderNoteLinks {
  const nodeRegex = /^\~\//;

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
    const dryFolderTree = createFolderTree(genealogies);
    console.log("dryFolderTree", dryFolderTree);

    // Add all the notes to the folderTree
    const folderTree = addTreeLeafs(dryFolderTree, notes);
    console.log("folderTree", folderTree);

    //Check in all the folders if there is already a "node" note
    //and create one if there is not
    await createNodeNotes(folderTree);

    //Link every folder "node" note to his parent "node" note
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
    const folderTree = { children: {}, id: "" };

    for (const genealogy of genealogies) {
      //Recursively create folder branches
      createBranch(folderTree, genealogy);
    }

    function createBranch(folderTree: any, genealogy: Array<any>) {
      const parentFolders = Object.keys(folderTree.children);

      if (genealogy.length === 0) return;

      // Create the branch if it doesn't exist
      if (parentFolders.indexOf(genealogy[0].id) === -1) {
        folderTree.children[genealogy[0].id] = {
          ...genealogy[0],
          children: {},
          notes: {},
        };
      }

      createBranch(folderTree.children[genealogy[0].id], genealogy.slice(1));
    }

    return folderTree;
  }

  function addTreeLeafs(dryFolderTree: any, notes: Array<any>) {
    // Add all the notes to the dry folder tree and return the
    // replenished folder tree
    const folderTree = { ...dryFolderTree };
    const remainingNotes = [...notes];

    addBranchLeafs(folderTree, remainingNotes);

    function addBranchLeafs(folderTree: any, remainingNotes: Array<any>) {
      if (remainingNotes.length === 0) return;
      if (Object.keys(folderTree.children).length === 0) return;

      for (const folder of Object.values(folderTree.children)) {
        for (let i = remainingNotes.length - 1; i >= 0; i--) {
          const note = remainingNotes[i];

          if (note.parent_id !== folder["id"]) continue;

          // Add the leaf (note)
          folderTree.children[folder["id"]].notes[note.id] = note;

          // Remove the note from remainingNotes
          remainingNotes.splice(remainingNotes.indexOf(note), 1);
        }

        addBranchLeafs(folderTree.children[folder["id"]], remainingNotes);
      }
    }

    return folderTree;
  }

  async function createNodeNotes(folderTree: any) {
    // Check in every folder for a "node" note,
    // and replace or create one according to the case

    await recursiveCheck(folderTree);

    async function recursiveCheck(folderTree: any) {
      if (Object.keys(folderTree).length === 0) {
        return;
      }
      const childrenFolders = Object.values(folderTree.children);

      for (const folder of childrenFolders) {
        const childrenNotes = Object.values(folder["notes"]);
        const folderNodeName = "~/" + folder["title"];
        let hasNodeNote = false;

        for (const note of childrenNotes) {
          if (!nodeRegex.test(note["title"])) continue;

          if (note["title"] === folderNodeName && !hasNodeNote) {
            hasNodeNote = true;
            continue;
          }

          // Delete the note if the name doesn't match de folderNodeName
          // or the note is a duplicate
          joplin.data.delete(["notes", note["id"]]);
        }

        await recursiveCheck(folder);

        if (hasNodeNote) continue;

        await joplin.data.post(["notes"], null, {
          title: folderNodeName,
          parent_id: folder["id"],
        });
      }
    }
  }
}

export default folderNoteLinks;
