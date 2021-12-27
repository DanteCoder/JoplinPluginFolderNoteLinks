import joplin from "api";

export namespace folderNoteLinks {
  const nodePrefix = "~/";
  const nodeRegex = new RegExp(`^${nodePrefix}.*`);
  const mdLinkRegexp = new RegExp(
    `\\[${nodePrefix}.*\\]\\(\\:\\/[a-z0-9]{32}\\)`,
    "gm"
  );

  const nodeNoteText =
    "This note was generated automatically." +
    "\nAnything you write here will be lost " +
    'everytime the plugin "Folder Note Links" runs';
  // The Regexp only works with folders that doesnt contain "[" or "]" in the title

  export async function init() {
    console.log("Folder Note Links plugin started!");

    //Register settings
  }

  export async function autoLink() {
    //Get all the folders
    const folders = await fetchFolders();

    //Get all the notes
    const notes = await fetchNotes();

    //Create the genealogy of every folder
    const genealogies = [];
    for (const folder of folders) {
      genealogies.push(folderGenealogy(folder, folders));
    }

    //Create the folderTree
    const dryFolderTree = createFolderTree(genealogies);

    // Add all the notes to the folderTree
    const folderTree = await addTreeLeafs(dryFolderTree, notes);

    //Check in all the folders if there is already a "node" note
    //and create one if there is not
    await createNodeNotes(folderTree);

    //Link every note through the "node" notes
    linkNotes(folderTree);
  }

  async function fetchFolders() {
    let folders = [];
    let pageNumber = 1;
    let hasMore = true;

    do {
      const response = await joplin.data.get(["folders"], {
        page: pageNumber,
      });
      folders = [...folders, ...response.items];
      hasMore = response.has_more;
      pageNumber += 1;
    } while (hasMore);

    return folders;
  }

  async function fetchNotes() {
    let notes = [];
    let pageNumber = 1;
    let hasMore = true;

    do {
      const response = await joplin.data.get(["notes"], {
        page: pageNumber,
      });
      notes = [...notes, ...response.items];
      hasMore = response.has_more;
      pageNumber += 1;
    } while (hasMore);

    return notes;
  }

  function folderGenealogy(childFolder: any, folders: Array<any>) {
    // This function creates an array of folders that are linked
    // through the parent - child relationship
    const genealogy = [childFolder];

    while (genealogy[genealogy.length - 1] !== "") {
      const parent = folders.find(
        (parent) =>
          parent.id === genealogy[genealogy.length - 1].parent_id
      );

      if (typeof parent === "undefined") break;

      genealogy.push(parent);
    }

    return genealogy.reverse();
  }

  function createFolderTree(genealogies: any[]) {
    // Create the folder tree from the genealogies of every folder
    const folderTree = {
      children: {},
      id: "",
      nodeNote: "",
      title: "",
    };

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
          nodeNote: "",
        };
      }

      createBranch(
        folderTree.children[genealogy[0].id],
        genealogy.slice(1)
      );
    }

    return folderTree;
  }

  async function addTreeLeafs(dryFolderTree: any, notes: Array<any>) {
    // Add all the notes to the dry folder tree and return the
    // replenished folder tree
    const folderTree = { ...dryFolderTree };
    const remainingNotes = [...notes];

    await addBranchLeafs(folderTree, remainingNotes);

    async function addBranchLeafs(
      folderTree: any,
      remainingNotes: Array<any>
    ) {
      if (remainingNotes.length === 0) return;
      if (Object.keys(folderTree.children).length === 0) return;

      for (const folder of Object.values(folderTree.children)) {
        const folderNodeName = nodePrefix + folder["title"];

        while (true) {
          const childNoteIndex = remainingNotes.findIndex(
            (note) => note.parent_id === folder["id"]
          );

          if (childNoteIndex === -1) break;

          const note = remainingNotes[childNoteIndex];

          // Remove the note from remainingNotes
          remainingNotes.splice(childNoteIndex, 1);

          // Add the leaf (note) if it's not a "node" note
          if (!nodeRegex.test(note.title)) {
            folderTree.children[folder["id"]].notes[note.id] = note;
            continue;
          }

          // Delete the note if it is the wrong node
          if (
            note.title !== folderNodeName ||
            folder["nodeNote"] !== ""
          ) {
            await joplin.data.delete(["notes", note.id]);
            continue;
          }

          folder["nodeNote"] = note.id;
        }

        await addBranchLeafs(
          folderTree.children[folder["id"]],
          remainingNotes
        );
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
        const folderNodeName = nodePrefix + folder["title"];

        await recursiveCheck(folder);

        // Create a "node" note if it doesn't exist
        if (folder["nodeNote"] !== "") continue;

        const response = await joplin.data.post(["notes"], null, {
          title: folderNodeName,
          parent_id: folder["id"],
        });

        folder["nodeNote"] = response.id;
      }
    }
  }

  async function linkNotes(folderTree: any) {
    // link "node" notes to his parent node
    // and link normal notes to his "node" note

    await recursive(folderTree);

    async function recursive(folderTree: any) {
      for (const folder of Object.values(folderTree.children)) {
        const parentFolderNodeName = nodePrefix + folderTree["title"];
        const folderNodeName = nodePrefix + folder["title"];

        //Link "node" notes to his parent node exept in root folders
        if (parentFolderNodeName !== nodePrefix) {
          const nodeNoteLink = `[${parentFolderNodeName}](:/${folderTree["nodeNote"]})`;
          joplin.data.put(["notes", folder["nodeNote"]], null, {
            body: nodeNoteText + "\n***\n" + nodeNoteLink,
          });
        } else {
          await joplin.data.put(["notes", folder["nodeNote"]], null, {
            body: nodeNoteText,
          });
        }

        for (const note of Object.values(folder["notes"])) {
          // Check if the note is already linked to a node
          // ---
          // Find any markdown link that starts with "nodePrefix"
          //  if the link doesn't point to the "node" note, update it
          //  if the link points to the "node" note, don't do anything
          // Create a new link if it doesn't exists
          const noteBody: string = (
            await joplin.data.get(["notes", note["id"]], {
              fields: ["body"],
            })
          ).body;

          // Find all the markdown links in the note
          const mdLinks = noteBody.match(mdLinkRegexp);

          let newNoteBody = noteBody;

          const nodeNoteLink = `[${folderNodeName}](:/${folder["nodeNote"]})`;

          if (mdLinks === null) {
            // Create a new link to the "node" note
            newNoteBody += `\n***\n${nodeNoteLink}`;
            joplin.data.put(["notes", note["id"]], null, {
              body: newNoteBody,
            });
            continue;
          }

          // Create a list of the mdLinks index
          const mdLinksPositions = [];
          let lastIndex = 0;
          for (const mdLink of mdLinks) {
            lastIndex = noteBody.indexOf(mdLink, lastIndex);
            mdLinksPositions.push(lastIndex);
            lastIndex += mdLink.length;
          }

          if (mdLinksPositions.length !== mdLinks.length) {
            throw "The list of mdLinks index was not generated correctly";
          }

          // Check if the links point to the "node" note
          let updateNote = false;

          for (let i = mdLinks.length - 1; i >= 0; i--) {
            const mdLink = mdLinks[i];

            const linkId = mdLink.substring(
              mdLink.length - 32 - 1,
              mdLink.length - 1
            );
            const linkName = mdLink.substring(
              1,
              mdLink.length - 4 - 32 - 1
            );

            // If the link is correct, do nothing
            if (
              linkName === folderNodeName &&
              linkId === folder["nodeNote"]
            )
              continue;

            // if the link is not correct, update it
            const part1 = newNoteBody.slice(0, mdLinksPositions[i]);
            let part2 = newNoteBody.slice(mdLinksPositions[i]);

            part2 = part2.replace(mdLink, nodeNoteLink);

            newNoteBody = part1 + part2;

            updateNote = true;
          }

          if (!updateNote) continue;

          joplin.data.put(["notes", note["id"]], null, {
            body: newNoteBody,
          });
        }

        if (Object.keys(folderTree.children).length === 0) return;

        recursive(folder);
      }
    }
  }
}

export default folderNoteLinks;
