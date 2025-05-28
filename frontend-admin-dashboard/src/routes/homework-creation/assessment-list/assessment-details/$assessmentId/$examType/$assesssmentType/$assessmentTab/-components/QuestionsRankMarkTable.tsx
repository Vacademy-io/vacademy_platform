import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { AssessmentOverviewMarksRankInterface } from '@/types/assessment-overview';

const AssessmentDetailsRankMarkTable = ({
    marksRanksData,
}: {
    marksRanksData: AssessmentOverviewMarksRankInterface[];
}) => {
    return (
        <div className="relative">
            <Table className="w-full table-auto">
                <TableHeader className="sticky top-0 z-10 bg-primary-100">
                    <TableRow className="w-full">
                        <TableHead className="w-1/4 rounded-tl-xl">Rank</TableHead>
                        <TableHead className="w-1/4">Marks</TableHead>
                        <TableHead className="w-1/4">Percentile</TableHead>
                        <TableHead className="w-1/4 rounded-tr-xl">No. of Participants</TableHead>
                    </TableRow>
                </TableHeader>
            </Table>
            <div className="max-h-[200px] overflow-y-auto">
                <Table className="w-full table-auto">
                    <TableBody>
                        {marksRanksData?.map((item) => (
                            <TableRow key={item.rank}>
                                <TableCell className="w-1/4">{item.rank}</TableCell>
                                <TableCell className="w-1/4">
                                    {item.marks ? item.marks.toFixed(2) : 0}
                                </TableCell>
                                <TableCell className="w-1/4">{item.percentile}%</TableCell>
                                <TableCell className="w-1/4">{item.no_of_participants}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AssessmentDetailsRankMarkTable;
