import { Alert, Button, Group } from '@mantine/core';
import './GuidedTour.scss';
import {
  IconBabyCarriage, IconBinaryTree, IconChristmasTree, IconLadder, IconPencilPlus, IconPlant,
} from '@tabler/icons-react';
import useUiState from '../../../useUiState';
import useTour from './useTour';

interface GuidedTourProps {
  onComplete: () => void;
}

const stepIcons: Record<string, React.FC> = {
  'plant-tree': IconPlant,
  'add-first-node': IconPencilPlus,
  'add-parent-nodes': IconBabyCarriage,
  'add-branching-nodes': IconBinaryTree,
  'complete-tree': IconLadder,
  'thats-it': IconChristmasTree,
};

const GuidedTour: React.FC<GuidedTourProps> = ({ onComplete }) => {
  const { dispatch } = useUiState();
  const { tourPhase, alertRef, handleNext, currentStep, isLastStep } = useTour(dispatch, onComplete);

  if (tourPhase.phase === 'complete' || !currentStep) return null;

  const StepIcon = stepIcons[currentStep.id];

  return <div className="GuidedTour">
    <Alert
      ref={alertRef}
      withCloseButton={false}
      radius="md"
      sx={{
        animationDuration: '0.5s',
        animationFillMode: 'forwards',
      }}
      icon={<StepIcon />}
      title={currentStep.title}
    >
      {currentStep.body}
      <Group mt="sm">
        <Button size="xs" onClick={handleNext}>
          {isLastStep ? 'Finish' : 'Next'}
        </Button>
      </Group>
    </Alert>
  </div>;
};

export default GuidedTour;
