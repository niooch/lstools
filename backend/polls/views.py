from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.template import loader

from .models import Question
def index(request):
    latestQuestionList = Question.objects.order_by("-pub_date")[:5]
    contex = {"latest_question_list": latestQuestionList}
    return render(request, "polls/index.html", contex)

def detail(request, question_id):
    question = get_object_or_404(Question, pk=question_id)
    print(
    return render(request, "polls/detail.html", {"question": question})

def results(request, question_id):
    responce = "you are looking at the rsoults of qiestion %s."
    return HttpResponse(responce % question_id)

def vote(request, question_id):
    return HttpResponse("You're voting on question %s." % question_id)

