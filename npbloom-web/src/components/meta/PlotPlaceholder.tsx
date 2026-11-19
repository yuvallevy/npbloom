import { Alert, Anchor } from '@mantine/core';
import './PlotPlaceholder.scss';
import LogoDim from './npbloom-logo-dim.svg';

interface PlotPlaceholderProps {
  showWelcome: boolean;
  acceptMouseEvents: boolean;
  onTourRequest: () => void;
}

const PlotPlaceholder: React.FC<PlotPlaceholderProps> = ({ showWelcome, acceptMouseEvents, onTourRequest }) =>
  <div className="PlotPlaceholder--container">
    {showWelcome ? <Alert
      className="PlotPlaceholder--alert"
      color="gray"
      title="Welcome to NPBloom!"
      style={{ pointerEvents: acceptMouseEvents ? 'auto' : 'none' }}
    >
      <div className="PlotPlaceholder--desktop-alert-content">
        To start, click anywhere and type a sentence,
        or <Anchor onClick={onTourRequest}>take the guided tour</Anchor>.
      </div>
      <div className="PlotPlaceholder--mobile-alert-content">
        NPBloom works best on desktop.<br />
        Come back on a larger screen to start,
        or <Anchor onClick={onTourRequest}>take the guided tour</Anchor>.
      </div>
    </Alert> : <img src={LogoDim} height={120} alt="NPBloom logo" />}
  </div>;

export default PlotPlaceholder;
