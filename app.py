
from flask import Flask, jsonify, request
from flask_cors import CORS

from services.model_service import predict_hiragana
from utils import model_config, preprocessing
from controllers.model_controller import model_bp


class JapaneseCharacterApp:

    def __init__(self, host="0.0.0.0", port=5000, debug=True):
        # Application configuration
        self.host = host
        self.port = port
        self.debug = debug

        # Flask application instance
        self.app = Flask(__name__)

        # Preprocessing function registry
        self.preprocessors = {
            "rud-lite": preprocessing.preprocess_lite,
            "rud-nano": preprocessing.preprocess_nano,
        }

        # Register application components
        self._configure_cors()
        self._register_blueprints()
        self._register_routes()

    def _configure_cors(self):
        CORS(
            self.app,
            origins=["http://localhost:5173"]
        )

    def _register_blueprints(self):
        self.app.register_blueprint(model_bp)

    def _register_routes(self):
        self.app.add_url_rule(
            "/api/predict/<model_name>",
            view_func=self.predict_controller,
            methods=["POST"],
            endpoint="predict_controller"
        )

    def predict_controller(self, model_name):
        # 1. Validate model name
        preprocess_func = self.preprocessors.get(model_name)

        if preprocess_func is None:
            return jsonify({
                "error": f"Unsupported model: {model_name}"
            }), 400

        # 2. Validate uploaded image
        if "image" not in request.files:
            return jsonify({
                "error": "No image provided"
            }), 400

        image = request.files["image"].read()

        if not image:
            return jsonify({
                "error": "Uploaded image is empty"
            }), 400

        try:
            # 3. Load model and class labels
            model = model_config.load_model(
                model_name=model_name
            )

            class_names = model_config.load_labels(
                model_name=model_name
            )

            # 4. Run prediction
            result = predict_hiragana(
                preprocess_func=preprocess_func,
                image=image,
                model=model,
                class_names=class_names
            )

            return jsonify(result), 200

        except ValueError as error:
            return jsonify({
                "error": str(error)
            }), 400

    def run(self):
        print(
            f"Server running at http://localhost:{self.port}"
        )

        self.app.run(
            host=self.host,
            port=self.port,
            debug=self.debug
        )

japanese_app = JapaneseCharacterApp()
app = japanese_app.app

if __name__ == "__main__":
    japanese_app.run()
