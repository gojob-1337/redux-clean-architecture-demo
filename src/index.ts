import { applyMiddleware, createStore } from 'redux';
import thunk, { ThunkAction } from 'redux-thunk';
import fetch from 'cross-fetch';

type Action<Type extends string, Payload> = { type: Type } & Payload;

function createAction<Type extends string, Payload>(type: Type, payload?: Payload): Action<Type, Payload> {
  return { type, ...payload } as Action<Type, Payload>;
}

// domain

enum QuestionType {
  UCQ = 'UCQ',
  MCQ = 'MCQ',
}

type Question = {
  id: string;
  type: QuestionType;
  text: string;
  answers: Answer[];
  isValidated: boolean;
};

type Answer = {
  id: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
};

type AppState = Question | null;

const setQuestion = (question: Question) => {
  return createAction('setQuestion', {
    question,
  });
};

const setAnswerSelected = (answer: Answer, isSelected = true) => {
  return createAction('setAnswerSelected', {
    answerId: answer.id,
    isSelected,
  });
};

const setQuestionValidated = (question: Question, isValidated = true) => {
  return createAction('setQuestionValidated', {
    questionId: question.id,
    isValidated,
  });
};

type AppAction = ReturnType<typeof setQuestion | typeof setAnswerSelected | typeof setQuestionValidated>;

const reducer = (state: AppState = null, action: AppAction): AppState => {
  if (action.type === 'setQuestion') {
    return action.question;
  }

  if (state === null) {
    return null;
  }

  if (action.type === 'setQuestionValidated') {
    return {
      ...state,
      isValidated: action.isValidated,
    };
  }

  if (action.type === 'setAnswerSelected') {
    const idx = state.answers.findIndex((answer) => answer.id === action.answerId);

    return {
      ...state,
      answers: [
        ...state.answers.slice(0, idx),
        {
          ...state.answers[idx],
          isSelected: action.isSelected,
        },
        ...state.answers.slice(idx + 1),
      ],
    };
  }

  return state;
};

const selectQuestion = (state: AppState) => {
  if (state === null) {
    throw Error('question is null');
  }

  return state;
};

const selectAnswers = (state: AppState) => {
  return selectQuestion(state).answers;
};

const selectSelectedAnswers = (state: AppState) => {
  return selectAnswers(state).filter((answer) => answer.isSelected);
};

const initStore = (deps: Dependencies) => {
  return createStore(reducer, applyMiddleware(thunk.withExtraArgument(deps)));
};

type AppThunk<ReturnType = void> = ThunkAction<ReturnType, AppState, Dependencies, AppAction>;

interface QuestionGateway {
  validate(answersIds: string[]): Promise<boolean>;
}

type Dependencies = {
  questionGateway: QuestionGateway;
};

const selectAnswer = (answer: Answer): AppThunk => {
  return (dispatch, getState) => {
    const question = selectQuestion(getState());
    const selectedAnswers = selectSelectedAnswers(getState());
    const firstSelectedAnswer = selectedAnswers[0];

    if (question.type === QuestionType.UCQ && firstSelectedAnswer) {
      dispatch(setAnswerSelected(firstSelectedAnswer, false));
    }

    dispatch(setAnswerSelected(answer, true));
  };
};

const validateQuestion = (): AppThunk<Promise<void>> => {
  return async (dispatch, getState, { questionGateway }) => {
    const question = selectQuestion(getState());
    const selectedAnswers = selectSelectedAnswers(getState());

    const success = await questionGateway.validate(selectedAnswers.map(({ id }) => id));

    if (!success) {
      throw new Error('response not ok');
    }

    dispatch(setQuestionValidated(question));
  };
};

// infra

class HttpQuestionGateway implements QuestionGateway {
  async validate(answersIds: string[]): Promise<boolean> {
    const response = await fetch('http://localhost:3000/validate-question', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ answersIds }),
    });

    return response.ok;
  }
}

const main = async () => {
  const store = initStore({
    questionGateway: new HttpQuestionGateway(),
  });

  const answer1: Answer = {
    id: 'answer1',
    text: 'good',
    isCorrect: true,
    isSelected: false,
  };

  const answer2: Answer = {
    id: 'answer2',
    text: 'baad',
    isCorrect: false,
    isSelected: false,
  };

  const question: Question = {
    id: 'question1',
    type: QuestionType.UCQ,
    text: 'How are you?',
    answers: [answer1, answer2],
    isValidated: false,
  };

  store.dispatch(setQuestion(question));

  store.dispatch(selectAnswer(answer1));
  store.dispatch(selectAnswer(answer2));

  await store.dispatch(validateQuestion());

  console.log(store.getState());
};

main().catch(console.error);
