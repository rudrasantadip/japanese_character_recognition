import os

import numpy as np

from utils import model_config, preprocessing

#LOAD TRAINED MODEL & CLASS NAME
MODEL_PATH = "../models/hiragana_model.keras"
ROMANJI_HIRAGANA_PATH=os.path.join('romanji_hiragana.json')



def predict_hiragana(preprocess_func,image,model,class_names):

    (model_input) = preprocess_func(image,target_size=43)
    prediction = model.predict(
        model_input,
        verbose=0
    )[0]


    predicted_index = int(np.argmax(
            prediction
    ))
    romaji=str(class_names[predicted_index][0])
    output={
        "predicted_index":predicted_index,
        "romaji":romaji,
        "native":class_names[predicted_index][1],
        "confidence":float(prediction[predicted_index]*100)
    }

    top_indices = np.argsort(
        prediction
    )[::-1][:5]
    
    temp={}

    for rank, index in enumerate(
        top_indices,
        start=1
    ):   
        index = int(index)  
        temp[rank]={
            "rank":rank,
            "romaji":str(class_names[index][0]),
            "native":class_names[index][1],
            "prediction":float(prediction[index]*100)
        }
    output["top_five"]=temp
    return output
       
