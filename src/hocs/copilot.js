// @flow
import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { View } from 'react-native';

import mitt from 'mitt';
import hoistStatics from 'hoist-non-react-statics';

import CopilotModal from '../components/CopilotModal';
import { OFFSET_WIDTH } from '../components/style';

import { getFirstStep, getLastStep, getStepNumber, getPrevStep, getNextStep } from '../utilities';

import type { Step, CopilotContext } from '../types';

/*
This is the maximum wait time for the steps to be registered before starting the tutorial
At 60fps means 2 seconds
*/
const MAX_START_TRIES = 120;

type State = {
  steps: { [string]: Step },
  currentStep: ?Step,
  visible: boolean,
  androidStatusBarVisible: boolean,
  backdropColor: string
};

const copilot = ({
  overlay,
  tooltipComponent,
  stepNumberComponent,
  animated,
  labels,
  androidStatusBarVisible,
  backdropColor,
  svgMaskPath,
  verticalOffset = 0,
  wrapperStyle,
} = {}) =>
  (WrappedComponent) => {
    class Copilot extends Component<any, State> {
	  minimumStep: ?Step = null;
	  maxiumStep: ?Step = null;
	  disableSkip: ?boolean = false;
	  
      state = {
        steps: {},
        currentStep: null,
        visible: false,
      };

      getChildContext(): { _copilot: CopilotContext } {
        return {
          _copilot: {
            registerStep: this.registerStep,
            unregisterStep: this.unregisterStep,
            getCurrentStep: () => this.state.currentStep,
          },
        };
      }

      componentDidMount() {
        this.mounted = true;
      }

      componentWillUnmount() {
        this.mounted = false;
      }

      getStepNumber = (step: ?Step = this.state.currentStep): number =>
        getStepNumber(this.state.steps, step);

      getFirstStep = (): ?Step => getFirstStep(this.state.steps);

      getLastStep = (): ?Step => getLastStep(this.state.steps);

      getPrevStep = (step: ?Step = this.state.currentStep): ?Step =>
        getPrevStep(this.state.steps, step);

      getNextStep = (step: ?Step = this.state.currentStep): ?Step =>
        getNextStep(this.state.steps, step);

      setCurrentStep = async (step: Step, move?: boolean = true): void => {
        await this.setState({ currentStep: step });
        this.eventEmitter.emit('stepChange', step);

        if (move) {
          this.moveToCurrentStep();
        }
      }

      setVisibility = (visible: boolean): void => new Promise((resolve) => {
        this.setState({ visible }, () => resolve());
      });

      startTries = 0;

      mounted = false;

      eventEmitter = mitt();

      isFirstStep = (): boolean => this.state.currentStep === (this.minimumStep ? this.minimumStep : this.getFirstStep());

      isLastStep = (): boolean => this.state.currentStep === (this.maxiumStep ? this.maxiumStep :this.getLastStep());

      registerStep = (step: Step): void => {
        this.setState(({ steps }) => ({
          steps: {
            ...steps,
            [step.name]: step,
          },
        }));
      }

      unregisterStep = (stepName: string): void => {
        if (!this.mounted) {
          return;
        }
        this.setState(({ steps }) => ({
          steps: Object.entries(steps)
            .filter(([key]) => key !== stepName)
            .reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {}),
        }));
      }

      next = async (): void => {
        await this.setCurrentStep(this.getNextStep());
      }

      prev = async (): void => {
        await this.setCurrentStep(this.getPrevStep());
      }

      start = async (options?: {fromStep?:string, 
							   minStep?: string,
							   maxStep?: string,
							   disableSkip?: boolean} = {} ): void => {
        const { steps } = this.state;
		const { fromStep, minStep, maxStep, disableSkip } = options;

        const currentStep = fromStep
          ? steps[fromStep]
          : this.getFirstStep();
		  
		this.minimumStep = minStep ? steps[minStep] : null;
		this.maxiumStep = maxStep ? steps[maxStep] : null;
		this.disableSkip = disableSkip;
		
        if (this.startTries > MAX_START_TRIES) {
          this.startTries = 0;
          return;
        }

        if (!currentStep) {
          this.startTries += 1;
          requestAnimationFrame(() => this.start(options));
        } else {
          this.eventEmitter.emit('start');
          await this.setCurrentStep(currentStep);
          await this.moveToCurrentStep();
          await this.setVisibility(true);
          this.startTries = 0;
        }
      }

      stop = async (): void => {
        await this.setVisibility(false);
        this.eventEmitter.emit('stop');
      }

      async moveToCurrentStep(): void {
        const size = await this.state.currentStep.target.measure();

        await this.modal.animateMove({
          width: size.width + OFFSET_WIDTH,
          height: size.height + OFFSET_WIDTH,
          left: size.x - (OFFSET_WIDTH / 2),
          top: (size.y - (OFFSET_WIDTH / 2)) + verticalOffset,
        });
      }

      render() {
        return (
          <View style={wrapperStyle || { flex: 1 }}>
            <WrappedComponent
              {...this.props}
              start={this.start}
              currentStep={this.state.currentStep}
              visible={this.state.visible}
              copilotEvents={this.eventEmitter}
            />
            <CopilotModal
              next={this.next}
              prev={this.prev}
              stop={this.stop}
              visible={this.state.visible}
              isFirstStep={this.isFirstStep()}
              isLastStep={this.isLastStep()}
              currentStepNumber={this.getStepNumber()}
              currentStep={this.state.currentStep}
			  disableSkip={this.disableSkip}
              labels={labels}
              stepNumberComponent={stepNumberComponent}
              tooltipComponent={tooltipComponent}
              overlay={overlay}
              animated={animated}
              androidStatusBarVisible={androidStatusBarVisible}
              backdropColor={backdropColor}
              svgMaskPath={svgMaskPath}
              ref={(modal) => { this.modal = modal; }}
            />
          </View>
        );
      }
    }

    Copilot.childContextTypes = {
      _copilot: PropTypes.object.isRequired,
    };

    return hoistStatics(Copilot, WrappedComponent);
  };

export default copilot;
