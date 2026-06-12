import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { Badge } from '@/components/ui/badge';
import { useDoubtQueryTypes } from '../../-services/use-doubt-query-types';

/**
 * Renders the configurable query category (Doubt / Technical Issue / Payment Issue / ...). Distinct
 * from the content-type "Type" column (VIDEO/PDF) — this is the issue category the learner picked.
 */
export const CategoryCell = ({ doubt }: { doubt: Doubt }) => {
    const { labelByKey, isKnownType } = useDoubtQueryTypes();
    const key = doubt.type ?? 'DOUBT';
    const label = labelByKey(key);
    const isDoubt = key.toUpperCase() === 'DOUBT';
    // DOUBT (academic) → primary; any other configured type → neutral; only an unknown/removed
    // type's key gets the amber "needs attention" treatment, so legitimate categories aren't
    // flagged as anomalous.
    const cls = isDoubt
        ? 'border-primary-200 bg-primary-50 text-primary-700'
        : isKnownType(key)
          ? 'border-neutral-200 bg-neutral-100 text-neutral-700'
          : 'border-warning-200 bg-warning-50 text-warning-700';

    return (
        <Badge variant="outline" className={`px-2 py-0.5 text-caption font-semibold ${cls}`}>
            {label}
        </Badge>
    );
};
