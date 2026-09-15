import EvaluationConverter from "../../components/center_factory/TrainingRecordManagement/modules/EvaluationConverter";

/** Google Forms / Microsoft Forms responses in, the evaluation chart workbook out. Two segments,
 *  so it wins over the single-segment /training-record/[section] route. */
export default function EvaluationConverterPage() {
  return <EvaluationConverter />;
}
