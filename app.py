from flask import Flask, render_template

app = Flask(__name__)

FLAG = "CYI3ER0N{GUYS_THE_FUN_IS_LIVE}"

@app.route('/')
def index():
    return render_template('index.html', flag=FLAG)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
