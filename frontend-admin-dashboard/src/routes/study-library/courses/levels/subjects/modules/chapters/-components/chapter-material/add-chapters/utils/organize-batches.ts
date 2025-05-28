interface OrganizedBatches {
    "10th Year/Class": string[];
    "9th Year/Class": string[];
    "8th Year/Class": string[];
}

export const organizeBatchesByClass = (batches: string[]) => {
    const organized: OrganizedBatches = {
        "10th Year/Class": [],
        "9th Year/Class": [],
        "8th Year/Class": [],
    };

    batches.forEach((batch) => {
        if (batch.startsWith("10th")) {
            organized["10th Year/Class"].push(batch);
        } else if (batch.startsWith("9th")) {
            organized["9th Year/Class"].push(batch);
        } else if (batch.startsWith("8th")) {
            organized["8th Year/Class"].push(batch);
        }
    });

    return organized;
};
